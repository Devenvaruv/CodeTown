import type { User } from "@shared/types";

export class UserService {
  getUser(): User {
    return { id: "1" };
  }
}
