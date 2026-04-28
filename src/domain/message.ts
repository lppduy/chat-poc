export class Message {
  constructor(
    public readonly id: string,
    public readonly roomId: string,
    public readonly senderId: string,
    public readonly content: string,
    public readonly createdAt: Date
  ) {}
}

export class MessagePage {
  constructor(
    public readonly messages: Message[],
    public readonly nextCursor: string | null
  ) {}
}
