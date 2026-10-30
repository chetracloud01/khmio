-- Website waitlist for the business solutions (docs/blueprint.md "Business
-- roadmap"): the website's coming-soon solution pages collect sign-ups as
-- product 'shop' with the business they're for. Prisma has nothing to change
-- (the columns are text); only the hand-written rule on business_type widens.
-- Add-only: every value allowed before is still allowed, so existing
-- sign-ups (teacher, school, landlord, other) stay valid and going back one
-- version still works.

-- Added by hand: the allowed business types (packages/shared WAITLIST_BUSINESS_TYPES).
ALTER TABLE waitlist_signups DROP CONSTRAINT waitlist_signups_business_type_known;
ALTER TABLE waitlist_signups
  ADD CONSTRAINT waitlist_signups_business_type_known CHECK (
    business_type IN ('teacher', 'school', 'landlord', 'other', 'garage', 'auto_parts', 'phone', 'cafe', 'salon', 'retail')
  );
