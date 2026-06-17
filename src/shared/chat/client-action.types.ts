/** Client-side affordances emitted over the AI chat WebSocket stream. */
export type ClientActionSheet =
  | 'buddy_post'
  | 'travel_guide'
  | 'itinerary'
  | 'personality_test';

export type ClientAction = {
  kind: 'open_sheet';
  sheet: ClientActionSheet;
  /** `prompt` shows a CTA button; `open` launches the sheet immediately. */
  mode?: 'prompt' | 'open';
};

export type ClientActionStreamEvent = {
  type: 'client_action';
  action: ClientAction;
};
