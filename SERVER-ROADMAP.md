# MTM server roadmap after v0.10.0

## Subscription and entitlement contract

The PWA contains dormant access enforcement. The server remains the authority and must return an `entitlement` object during registration and login:

```json
{
  "enforced": true,
  "level": "owner | trial | subscriber | expired",
  "subscriptionStatus": "active | past_due | cancelled | none",
  "trialStartedAt": "ISO-8601 timestamp or null",
  "trialEndsAt": "ISO-8601 timestamp or null",
  "householdPlanOwnerId": "account id or null"
}
```

- New accounts receive one seven-day full-access trial.
- Start the trial once, after onboarding completes. Reinstalling, joining a new household, or creating another profile must not restart it.
- Permanent owner access belongs to the two designated server-side account IDs. Do not infer it from a client value or editable email address.
- One active subscription covers authorized members of its household.
- An expired account retains sign-in, subscription management, privacy controls, complete export, and account deletion.
- Expiration never deletes or hides the user's saved records. Paid routes stop accepting use until access returns.
- Cache a signed, short-lived entitlement for offline use. The client must not be able to extend or create access by editing local storage.
- Validate entitlements on paid server endpoints as well as in the PWA.
- Refresh the entitlement after login, registration, subscription changes, household changes, and payment-provider webhooks.

Payment-provider choice, monthly and yearly prices, trial reminders, cancellation timing, failed-payment grace periods, refunds, and app-store purchasing remain launch decisions.

## Shared community platform

Build one moderated community service rather than separate search systems for each feature. Reuse the current Social Meetups location and filtering approach.

Shared capabilities:

- Account-required posting and protected contact relay
- Approximate city/ZIP location with radius search; never expose a child's profile or home address
- Status, created and updated timestamps, expiration, owner editing, and soft deletion
- Keyword, category, specialty, distance, and availability filters
- Reporting, blocking, moderation queue, audit history, rate limits, and abuse controls
- Duplicate detection for public places and providers

### Free Toy Exchange

- Free items only; MTM does not process payments
- Photos, title, description, category, age range, condition, approximate location, and available/claimed/gone status
- Prohibited-item rules and public-meeting safety reminders

### Recommended Places and Providers

- Categories for doctors, dentists, therapists, restaurants, personal care, activities, education, and other locations
- Provider/place record separated from individual caregiver recommendations so duplicates can merge
- Practical details such as specialty, ages served, insurance notes, accessibility, sensory information, website, and contact information
- Begin with specific written recommendations instead of anonymous star ratings

### Recommended Babysitters

- A caregiver submits a sitter's name and email only to send an invitation
- Do not publish a profile until the sitter verifies the email, accepts, and completes their own profile
- The sitter controls public fields, service area, contact method, profile status, and deletion
- Never expose the sitter's email address
- Do not label a sitter vetted, certified, or background-checked without a real verification process
- Keep this directory separate from temporary household babysitter access and the babysitter care sheet

## Product recommendations

- Add curated product links after launch
- Keep affiliate disclosure close to affiliate links and include the required Amazon Associate statement
- Do not hard-code prices or availability without an approved current-data method
- Keep communication tools and safety information independent of purchases
