import { Room } from '../../domain/room';

export interface RoomResponse {
  roomId: string;
  name: string | null;
  type: string;
  members: string[];
}

export class RoomResponseMapper {
  static fromDomain(room: Room): RoomResponse {
    return {
      roomId: room.id,
      name: room.name,
      type: room.type,
      members: room.members,
    };
  }
}
