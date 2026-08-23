import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(
            new Error("Google account has no email")
          );
        }

        const name = profile.displayName || "User";

        const avatar =
          profile.photos?.[0]?.value || null;

        const user = await prisma.user.upsert({
          where: {
            googleId,
          },

          update: {
            name,
            email,
            avatar,
          },

          create: {
            googleId,
            name,
            email,
            avatar,
          },
        });

        return done(null, user);
      } catch (error) {
        return done(error, undefined);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(
  async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id,
        },
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
);

export default passport;