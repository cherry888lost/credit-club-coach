# Credit Club Close Types

## Core Rule
Outcome and close_type are not the same thing.

- outcome = overall result of the sales conversation
- close_type = specific commercial structure used if the call actually closes

## Standard Outcomes
Use these outcome categories:
- closed
- follow_up
- no_sale
- disqualified

Default rule:
Do NOT use disqualified unless the transcript clearly shows the person is not an appropriate prospect.
Do NOT overuse disqualified as a lazy label.

## Close Types
Only use close_type when outcome = closed.

Allowed close_type values:
- full_close
- deposit
- payment_plan
- partial_access
- null

If outcome is not closed, close_type should normally be null.

## Definitions

### full_close
The prospect pays the full programme price on the call.
Current standard full price discussed in calls:
- £3,000

Evidence required:
- explicit agreement to pay in full
- full payment taken / confirmed
- clear statement that they are fully joining now### deposit
The prospect places a smaller commitment payment now to secure the offer / price / place, with the remainder due later.

Typical business logic:
- can be small
- common target range is roughly £300–£500
- sometimes lower deposits are accepted

Evidence required:
- clear deposit amount or clear statement that only a deposit is being paid now
- explicit understanding that the remainder is due later

Do NOT label something as deposit just because the prospect says "I'll send something later".
There must be an actual commitment now.

### payment_plan
The prospect does not pay the full amount at once but commits to a structured split.

Current known structures:
- £2,000 + £1,000
- £1,500 + £1,500

Evidence required:
- clear agreement to instalments
- clear first payment now
- explicit second payment later

### partial_access
A special structure used only in specific cases where the team is highly confident they can quickly help the prospect open the target business card.

Business logic:
- prospect pays an initial amount (commonly £500)
- prospect initially receives support access only
- the first goal is to get the business card approved
- after approval / card arrival, the remainder is paid to unlock full programme access

Evidence required:
- explicit mention of partial access or equivalent staged structure
- clear statement that only Telegram / application support is being unlocked first
- clear statement that full programme access comes after the remainder is paid

Do NOT guess partial_access unless this staged structure is explicit.

### follow_up
Use follow_up when:
- the sale has not fully closed on this call
- there is a meaningful next step or continuation
- there is a second call planned
- the prospect is actively considering and not dead
- the team is collecting a remaining balance later
- the prospect has already partially committed and the next task is to complete onboarding/payment

Important:
A follow-up is not a close type unless money has already been taken and the overall outcome is already closed.
If no money has been taken and the decision is not final, it is simply outcome = follow_up and close_type = null.

### no_sale
Use no_sale when:
- no payment is taken
- no meaningful commitment is made
- the conversation ends without an active path forward

## Evidence Rules
The model must not guess close_type.
Use close_type only when the transcript explicitly supports it.
If unclear:
- set close_type = null
- classify the broader outcome only

## Manual Override Rules
If the system contains manual outcome / manual close_type fields:
- manual outcome overrides AI outcome
- manual close_type overrides AI close_type

The reasoner should treat manual labels as source-of-truth whenever present.

## Common Mistakes To Avoid
Do NOT confuse:
- a second call with a closed deal
- a promise to think about it with a follow-up worth scoring as strong
- a vague "I'm in" with an actual payment structure
- partial_access with deposit
- payment_plan with deposit
- no_sale with disqualified

## Strong Classification Principle
The model should prefer:
- accurate null
over
- a guessed close_type

Being cautious is better than hallucinating structure that never happened.