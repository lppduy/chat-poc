export interface CreateRoomRequest {
  name: string;
  memberIds: string[];
}

export interface DmStartRequest {
  targetUserId: string;
}
