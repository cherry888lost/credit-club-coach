# Credit Club Extraction Rules

## Purpose
This file governs what the reasoner is allowed to send into the Learning Queue.The Learning Queue is NOT for random observations.
It is only for candidate patterns that are:
- specific
- useful
- repeatable
- grounded in exact transcript evidence
- relevant to Credit Club selling
- worthy of human review

## Golden Rule
If a pattern would not improve future scoring or future rep coaching, do not queue it.

## Allowed Candidate Categories
Only allow candidates in these categories:
- discovery_quality
- pain_amplification
- offer_explanation
- confidence_authority
- objection_handling
- close_quality
- urgency_close
- next_steps_clarity

Optional later:
- follow_up_positioning
- application_positioning
- travel_redemption_positioning
- business_card_positioning

## What MUST Be Present For A Queue Candidate
Every queued learning candidate must include all of the following:
- candidate_category
- candidate_title
- confidence_score (0–100)
- exact_prospect_quote
- exact_rep_quote
- why_this_mattered
- why_this_is_repeatable
- source_call_id
- source_transcript_section
- source_outcome
- source_close_type (if explicitly known)
- relevant category score(s)
- reason_for_queueing
- suggested_action:
 - reject
 - approve
 - promote

If any of this is missing, do not queue it.

## Minimum Quality Thresholds
Do NOT queue a candidate unless ALL of these are true:
- transcript is a real sales call
- transcript is not low-signal
- confidence_score >= 80
- relevant category score >= 8
- there is an exact prospect line and an exact rep line
- the pattern is specific enough to reuse
- the result of the move is visible in the transcript

For "promote" recommendations:
- confidence_score should usually be >= 90
- source call should usually be outcome = closed or very strong follow_up
- pattern should be clearly transferable to future calls

## Rules By Category

### Discovery Quality
Queue only if:
- rep uncovers a specific high-value motive
- prospect explicitly reveals a strong desired outcome or pain
- discovery clearly improves the sales path

Do NOT queue:
- generic opening questions
- basic fact gathering
- surface-level banter

### Pain Amplification
Queue only if:
- rep turns a vague issue into a meaningful consequence
- the pain becomes clearer, more urgent, or more emotionally real
- it is tied to the prospect's actual goals

Do NOT queue:
- generic statements like "that must be frustrating"
- vague empathy with no leverage
- exaggerated pressure

### Offer Explanation
Queue only if:
- rep explains the mechanism clearly
- explanation is tied to the prospect's problem
- value becomes concrete

Do NOT queue:
- generic feature listing
- "we have a community and videos"
- broad statements with no relevance

### Confidence & Authority
Queue only if:
- authority is displayed through clarity, certainty, or strong framing that actually helps the sale

Do NOT queue:
- generic confidence
- tone alone without a meaningful sales move
- casual friendliness mistaken for authority

### Objection Handling
Queue only if:
- the objection is real and explicit
- the rep response is also explicit
- the rep meaningfully moves the objection forward
- the transcript shows the prospect softening, clarifying, agreeing, or moving closer

Do NOT queue:
- "objection detected but not handled well"
- guessed objections
- generic responses
- moments where the rep simply talks more

### Close Quality
Queue only if:
- the rep makes a clear ask
- the ask is tied to the prospect's goals or solved concerns
- the close is meaningful and advances the deal

Do NOT queue:
- weak soft closes
- "let me know"
- passive end-of-call lines

### Urgency & Close
Queue only if:
- urgency is real, relevant, and grounded in the prospect's situation
- delay is linked to lost outcomes, not fake scarcity

Do NOT queue:
- random urgency lines
- vague "do it now"
- pressure without logic

### Next Steps Clarity
Queue only if:
- the next step is concrete
- timing is clear
- payment structure or application path is clearly laid out

Do NOT queue:
- vague "we'll follow up"
- unclear promises
- open loops

## Hard Rejection RulesAutomatically reject any candidate that is:
- generic friendliness
- rapport banter only
- humour with no sales value
- a guessed close_type
- a guessed outcome
- an unclear objection
- not tied to a specific transcript quote
- not transferable to future calls
- admin-only
- support-only
- too short / low-signal
- based on a weak or failed rep move
- based on a candidate confidence below threshold
- not clearly Credit Club relevant

## Specific Things That Should NEVER Be Treated As Strong Learning
Never promote these:
- small talk
- travel chatter unrelated to a sale move
- generic rapport
- "sounds good"
- weak agreement mistaken for progress
- AI-guessed close types
- AI-guessed objection categories
- a rep simply being nice
- repetition without leverage
- any candidate where the prospect never actually moved

## Special Rule For Objections
A learning entry about an objection must contain:
- the exact objection in the prospect's own words
- the exact rep response
- why the response worked or failed
- what type of objection it was:
 - money
 - time
 - spouse_partner
 - trust_skepticism
 - avoidance_need_to_think
 - fit_preference
 - other

If the objection is not explicit, do not queue it.

## Special Rule For Close Type / Outcome Learnings
Do not let the queue learn from:
- inferred full closes
- inferred deposits
- inferred payment plans
- inferred partial access
- inferred follow-ups

Outcome / close_type learnings require explicit evidence.

## Promotion Logic
Learning Queue flow should be:
1. candidate created
2. human reviews candidate
3. approved candidate may be promoted
4. only promoted candidates become reusable system memory

There is NO direct auto-promotion into the live knowledge base.

## Candidate Output Format
Every queue item should follow this exact structure:
- category:
- title:
- confidence:
- prospect_quote:
- rep_quote:
- what_happened:
- why_it_mattered:
- why_it_is_repeatable:
- source_call_id:
- source_outcome:
- source_close_type:
- relevant_score:
- recommendation:

## Review Guidance For Humans
Approve when:
- specific
- true
- useful
- repeatable
- Credit Club relevant

Reject when:
- generic
- weak
- guessed
- non-transferable
- not actually a sales move