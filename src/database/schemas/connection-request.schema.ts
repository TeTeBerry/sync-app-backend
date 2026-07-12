import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConnectionRequestDocument = HydratedDocument<ConnectionRequest>;

@Schema({ collection: 'festival_squad_connection_requests', timestamps: true })
export class ConnectionRequest {
  @Prop({ required: true, index: true }) senderProfileId!: string;
  @Prop({ required: true, index: true }) receiverProfileId!: string;
  @Prop({ required: true, index: true }) eventId!: number;
  @Prop({
    required: true,
    enum: ['festival_buddy', 'roommate', 'ride_share', 'travel_group'],
  })
  intent!: string;
  @Prop({ required: true, maxlength: 140 }) message!: string;
  @Prop({
    required: true,
    default: 'pending',
    enum: ['pending', 'accepted', 'declined', 'cancelled'],
  })
  status!: string;
}

export const ConnectionRequestSchema =
  SchemaFactory.createForClass(ConnectionRequest);
ConnectionRequestSchema.index(
  { senderProfileId: 1, receiverProfileId: 1, eventId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
