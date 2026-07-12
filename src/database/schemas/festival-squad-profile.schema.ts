import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FestivalSquadProfileDocument =
  HydratedDocument<FestivalSquadProfile>;

const ProfileVisibilitySchema = {
  showExactCity: { type: Boolean, default: true },
  showCountryOnly: { type: Boolean, default: false },
  showAccommodationName: { type: Boolean, default: true },
  showAccommodationTypeOnly: { type: Boolean, default: false },
  allowConnectionRequests: { type: Boolean, default: true },
  hideProfile: { type: Boolean, default: false },
};

@Schema({ collection: 'festival_squad_profiles', timestamps: true })
export class FestivalSquadProfile {
  @Prop({ required: true, index: true }) userId!: string;
  @Prop({ required: true, index: true }) eventId!: number;
  @Prop({ required: true, maxlength: 80 }) displayName!: string;
  @Prop() avatarUrl?: string;
  @Prop({ maxlength: 80 }) originCity!: string;
  @Prop({ maxlength: 80 }) originCountry?: string;
  @Prop({ required: true }) arrivalDate!: string;
  @Prop({ required: true }) departureDate!: string;
  @Prop({
    required: true,
    enum: ['booked', 'planning', 'looking_roommates', 'not_decided'],
  })
  accommodationStatus!: string;
  @Prop({
    required: true,
    enum: ['dreamville', 'camping', 'hotel', 'hostel', 'not_decided'],
  })
  accommodationType!: string;
  /** Optional stay label for display; never used as a hard identity signal. */
  @Prop({ maxlength: 120 }) accommodationName?: string;
  @Prop({ required: true, enum: ['budget', 'comfort', 'premium'] })
  budgetLevel!: string;
  /** Artist catalog ids only; used for matching. */
  @Prop({ type: [String], default: [] }) favoriteArtistIds!: string[];
  /** Display names for UI round-trip; matching still uses favoriteArtistIds. */
  @Prop({ type: [String], default: [] }) favoriteArtists!: string[];
  /** Non-artist or not-yet-catalogued lineup selections; never used for matching. */
  @Prop({ type: [{ lineupEntryId: String, status: String }], default: [] })
  unresolvedLineupEntries!: Array<{
    lineupEntryId: string;
    status: 'unresolved';
  }>;
  @Prop({ type: [String], default: [] }) favoriteGenres!: string[];
  @Prop({ type: [String], default: [] }) lookingFor!: string[];
  @Prop({ type: [String], default: [] }) languages!: string[];
  @Prop({ default: 1, min: 1, max: 8 }) groupSize!: number;
  @Prop() firstTimeAttendee?: boolean;
  @Prop({ maxlength: 280 }) shortNote?: string;

  /** Public detail controls; contact and booking data are never stored here. */
  @Prop({ type: ProfileVisibilitySchema, default: () => ({}) })
  visibility!: {
    showExactCity: boolean;
    showCountryOnly: boolean;
    showAccommodationName: boolean;
    showAccommodationTypeOnly: boolean;
    allowConnectionRequests: boolean;
    hideProfile: boolean;
  };

  /** Retains the profile while removing it from new-match discovery. */
  @Prop({ default: false, index: true }) matchingPaused!: boolean;
}

export const FestivalSquadProfileSchema =
  SchemaFactory.createForClass(FestivalSquadProfile);
FestivalSquadProfileSchema.index({ userId: 1, eventId: 1 }, { unique: true });
FestivalSquadProfileSchema.index({ eventId: 1, updatedAt: -1 });
