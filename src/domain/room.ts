export enum RoomType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export class Room {
  constructor(
    public readonly id: string,
    public readonly type: RoomType,
    public readonly name: string | null,
    public readonly createdAt: Date,
    public readonly members: string[] = []
  ) {}
}
