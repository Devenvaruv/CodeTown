import { UserService } from "../users/user.service";

export function createAuthService() {
  return new UserService();
}
