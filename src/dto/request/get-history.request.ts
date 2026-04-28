export interface GetHistoryRequest {
  roomId: string;
  cursor?: string;
  limit?: number;
}
