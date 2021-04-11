interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export const validateRegister = (input: RegisterInput) => {
  const emailRegex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  const usernameRegex = /[a-zA-Z0-9]{3,12}/;

  if (!emailRegex.test(input.email)) {
    return "incorrect email";
  }

  if (!usernameRegex.test(input.username)) {
    return "username should be 3-12 characters";
  }

  if (input.password.length < 4) {
    return "password must be at least 8 characters";
  }
};
