import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyLoginDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}
