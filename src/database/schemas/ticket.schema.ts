import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TicketDocument = Ticket & Document;

@Schema({ timestamps: true })
export class Ticket {
  @Prop()
  activityId?: string;

  @Prop()
  userId?: string;

  @Prop()
  skuCode?: string;

  @Prop()
  status?: string;

  @Prop({ type: Object })
  seatOrSlot?: Record<string, unknown>;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
