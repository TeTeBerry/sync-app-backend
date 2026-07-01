import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

const SMS_ENDPOINT = 'https://sms.tencentcloudapi.com/';
const SMS_HOST = 'sms.tencentcloudapi.com';
const SMS_SERVICE = 'sms';
const SMS_REGION = 'ap-guangzhou';
const SMS_VERSION = '2021-01-11';

type SmsConfig = {
  secretId: string;
  secretKey: string;
  sdkAppId: string;
  templateId: string;
  signName: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  private resolveConfig(): SmsConfig {
    const secretId =
      this.config.get<string>('cloudbase.secretId') ||
      process.env.TENCENTCLOUD_SECRETID ||
      '';
    const secretKey =
      this.config.get<string>('cloudbase.secretKey') ||
      process.env.TENCENTCLOUD_SECRETKEY ||
      '';
    const sdkAppId = this.config.get<string>('auth.sms.sdkAppId') || '';
    const templateId = this.config.get<string>('auth.sms.templateId') || '';
    const signName = this.config.get<string>('auth.sms.signName') || '';

    return { secretId, secretKey, sdkAppId, templateId, signName };
  }

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    const cfg = this.resolveConfig();
    if (!cfg.secretId || !cfg.secretKey) {
      throw new ServiceUnavailableException('短信服务未配置');
    }
    if (!cfg.sdkAppId || !cfg.templateId || !cfg.signName) {
      throw new ServiceUnavailableException('短信模板未配置');
    }

    const payload = JSON.stringify({
      SmsSdkAppId: cfg.sdkAppId,
      SignName: cfg.signName,
      TemplateId: cfg.templateId,
      TemplateParamSet: [code],
      PhoneNumberSet: [`+86${phone}`],
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const authorization = this.signTc3(
      cfg.secretId,
      cfg.secretKey,
      SMS_SERVICE,
      SMS_HOST,
      SMS_REGION,
      'SendSms',
      SMS_VERSION,
      payload,
      timestamp,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-TC-Action': 'SendSms',
      'X-TC-Version': SMS_VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': SMS_REGION,
      Authorization: authorization,
    };

    let res: Response;
    try {
      res = await fetch(SMS_ENDPOINT, {
        method: 'POST',
        headers,
        body: payload,
      });
    } catch (error) {
      this.logger.error(
        `SMS fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('短信服务暂时不可用');
    }

    const json = (await res.json()) as {
      Response?: {
        Error?: { Code: string; Message: string };
        SendStatusSet?: Array<{ Code: string; Message: string }>;
      };
    };

    const responseError = json.Response?.Error;
    if (responseError) {
      this.logger.error(
        `SMS API error: ${responseError.Code} - ${responseError.Message}`,
      );
      throw this.mapSmsError(responseError.Code, responseError.Message);
    }

    const sendStatus = json.Response?.SendStatusSet?.[0];
    if (sendStatus && sendStatus.Code !== 'Ok') {
      throw new BadRequestException(sendStatus.Message || '短信发送失败');
    }

    this.logger.log(`SMS sent to +86${phone}`);
  }

  private signTc3(
    secretId: string,
    secretKey: string,
    service: string,
    host: string,
    region: string,
    action: string,
    version: string,
    payload: string,
    timestamp: number,
  ): string {
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    const algorithm = 'TC3-HMAC-SHA256';

    // Step 1: Canonical Request
    const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';
    const hashedPayload = crypto
      .createHash('sha256')
      .update(payload)
      .digest('hex');
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

    // Step 2: String to Sign
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex');
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    // Step 3: Signature
    const kDate = crypto
      .createHmac('sha256', `TC3${secretKey}`)
      .update(date)
      .digest();
    const kService = crypto
      .createHmac('sha256', kDate)
      .update(service)
      .digest();
    const kSigning = crypto
      .createHmac('sha256', kService)
      .update('tc3_request')
      .digest();
    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');

    return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private mapSmsError(code: string, message: string): Error {
    const mapping: Record<string, () => Error> = {
      'FailedOperation.PhoneNumberInBlacklist': () =>
        new BadRequestException('该号码被运营商限制'),
      'LimitExceeded.PhoneNumberDailyLimit': () =>
        new BadRequestException('今日发送次数已达上限，请明天再试'),
      'LimitExceeded.PhoneNumberOneHourLimit': () =>
        new BadRequestException('发送过于频繁，请稍后再试'),
      'LimitExceeded.PhoneNumberThirtySecondLimit': () =>
        new BadRequestException('发送过于频繁，请稍后再试'),
      'FailedOperation.TemplateIncorrectOrUnapproved': () => {
        this.logger.error(`SMS template not approved: ${message}`);
        return new ServiceUnavailableException('短信服务配置异常');
      },
      'InvalidParameterValue.TemplateParameterLengthLimit': () =>
        new ServiceUnavailableException('短信参数超长'),
      'FailedOperation.SignatureIncorrectOrUnapproved': () => {
        this.logger.error(`SMS signature not approved: ${message}`);
        return new ServiceUnavailableException('短信签名未审核通过');
      },
    };

    const factory = mapping[code];
    if (factory) return factory();

    this.logger.error(`Unhandled SMS error ${code}: ${message}`);
    return new ServiceUnavailableException('短信发送失败，请稍后重试');
  }
}
