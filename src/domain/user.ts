export class User {
  constructor(
    public readonly id: string,
    public readonly displayName: string,
    public readonly createdAt: Date
  ) {}
}
