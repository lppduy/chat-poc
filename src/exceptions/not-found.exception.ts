import { AppException } from './app.exception';

export class NotFoundException extends AppException {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND');
  }
}
