# Connect Twilio OTP delivery

Use Twilio Verify for the trial account and for OTP-specific delivery. Better Auth still manages users and sessions in MongoDB; Twilio generates, sends, and checks the SMS code.

## Set up Twilio

1. Open the [Twilio Console](https://console.twilio.com/). Find **Identity → Verify → Overview → Try out Verify**. Some accounts show this under **Explore products → Verify**.
2. Follow the trial flow to send and check a code on your own verified number.
3. Create or select a **Verify Service** for Travel Bite. Enable SMS and use a six-digit code. Its service SID starts with `VA`; a verification SID starting with `VE` is a different resource.
4. Add the client's Indian mobile number as a verified trial recipient. They must receive and enter Twilio's confirmation code. Your signup phone number is already verified. Trials permit up to five verified recipients and restrict SMS to the signup country.
5. Copy your **Account SID** (starts with `AC`), **Auth Token**, and **Verify Service SID** from the Console. Enter secrets directly into your local environment or Vercel, not a chat or source file.

Verify handles the sending number. You do not need to buy a number or set `TWILIO_FROM_NUMBER` for this integration. The trial has an expiration date, usage limits, and a predefined verification template. Check the Console's free-units tracker. See the [Verify trial guide](https://www.twilio.com/docs/usage/trials/try-out-verify) and [trial restrictions](https://www.twilio.com/docs/usage/trials).

## Configure Travel Bite

Add these settings privately to `.env.local` for local SMS testing:

```dotenv
DEV_SMS=false
TWILIO_ACCOUNT_SID=AC_your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=VA_your_verify_service_sid
```

The values above are placeholders. Real account and service SIDs contain their prefix followed by 32 characters. Keep your existing database, Better Auth, and admin settings, then restart `npm run dev`. Development with `DEV_SMS=true` continues to print local codes instead of sending SMS.

For Vercel, add the same settings under **Project → Settings → Environment Variables** for the deployment environment you will share. Set `BETTER_AUTH_URL` to the exact HTTPS website URL. Keep a strong persistent `BETTER_AUTH_SECRET` and a MongoDB replica-set connection that Vercel can reach. A localhost database URI will not work there. Redeploy after changing environment values. These settings must remain server-side, without a `NEXT_PUBLIC_` prefix.

## Test delivery

Open Travel Bite and request a login code for a trial-verified `+91` number. It should arrive by SMS. Enter the six-digit code to complete login. Verify uses a ten-minute validity window by default; local terminal and legacy SMS codes use five minutes.

If sending or checking fails, inspect **Twilio Console → Verify → Logs**. Check the recipient's trial verification, remaining allowance, account and service SIDs, and **Verify Geo Permissions** for India. Before sharing the link, verify the client's number and test the same flow with them. Admin login at `/admin/login` remains separate and does not use SMS.

If the Verify service SID is absent, the legacy Programmable Messaging integration uses `TWILIO_FROM_NUMBER` and Better Auth's generated code. New trial accounts restrict custom message bodies, so use Verify for the trial. No real SMS is sent by automated tests; actual delivery still needs testing with your credentials and verified recipient.
