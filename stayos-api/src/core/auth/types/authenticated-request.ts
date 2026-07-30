import { Request } from 'express';
import { AuthUserDto } from '../dto/auth-user.dto';

export interface AuthenticatedRequest extends Request {
  currentUser?: AuthUserDto & { sessionId: string };
}
