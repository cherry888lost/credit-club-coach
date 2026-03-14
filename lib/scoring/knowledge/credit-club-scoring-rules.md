# Credit Club Call Scoring Rules

This file defines the official scoring framework used by the Credit Club AI reasoner.

The AI must score sales calls using the categories below and follow the scoring guidance strictly.

The goal of the scoring system is to:

• evaluate rep performance
• identify coaching opportunities
• extract strong sales techniques
• improve training data

The AI must prioritise sales effectiveness, not generic conversation quality.

---

# Scoring Categories

Each call must be scored across the following categories:

1. Call Control
2. Rapport & Tone
3. Discovery Quality
4. Offer Explanation
5. Next Steps Clarity
6. Objection Handling
7. Pain Amplification
8. Confidence & Authority
9. Close Quality
10. Urgency & Close

Each category is scored from 1 to 10.

---

# Category Definitions

## 1. Call Control

Measures how well the rep controls the flow of the conversation.

Strong examples:
• clear agenda
• guiding the prospect through the call
• preventing rambling
• keeping conversation focused

Weak examples:
• letting prospect derail the call
• no structure
• jumping randomly between topics

Score guide:

10 → Rep fully controls conversation 
7 → Mostly controlled with minor drift 
5 → Mixed control 
3 → Prospect controls conversation 
1 → No structure at all

---

## 2. Rapport & Tone

Measures natural connection and trust building.

Strong examples:
• personal interest
• matching prospect tone
• conversational flow
• empathy

Weak examples:
• robotic delivery
• scripted tone
• no emotional connection

Important rule:

Rapport alone does not equal a strong call.

Rapport must support the sales process.

---

## 3. Discovery Quality

Measures how well the rep identifies the prospect's situation.

The rep should uncover:

• credit issues
• travel goals
• business spending
• current cards
• financial goals
• frustration points

Strong discovery includes:

"What cards are you currently using?" 
"What are you trying to get approved for?" 
"Do you travel often for business or personal?"

Weak discovery includes:

• surface questions only
• not understanding the prospect's problem

---

## 4. Offer Explanation

Measures how clearly the rep explains Credit Club.

A strong explanation includes:

• what the program is
• what tools they get
• how it solves the prospect's problem
• what makes it unique

Strong example:

"The reason members join is because the order of opening the American Express cards matters. If you open them wrong you lose the sign-up bonuses."

Weak example:

"We have a course that teaches travel hacking."

---

## 5. Next Steps Clarity

Measures how clearly the rep explains what happens after joining.

Strong examples:

• support system explanation
• Telegram help structure
• credit specialist support
• Zoom application assistance

Prospect should clearly understand:

"What happens after they pay."

---

## 6. Objection Handling

Measures how well the rep handles objections.

Common objections:

• "I need to speak to my partner"
• "It's expensive"
• "Sounds too good to be true"
• "I want to think about it"

Strong handling includes:

• acknowledging objection
• reframing value
• returning control to rep

Weak handling includes:

• ignoring objection
• discounting
• sounding defensive

---

## 7. Pain Amplification

Measures whether the rep highlights the cost of not fixing the problem.

Examples:

• missed points opportunities
• poor credit preventing approvals
• wasted spending

Strong example:

"If the cards are opened in the wrong order you lose the sign-up bonuses completely."

Weak example:

no clear consequence discussed.

---

## 8. Confidence & Authority

Measures the rep's authority.

Strong indicators:

• clear explanations
• confident delivery
• experience references
• explaining process step-by-step

Weak indicators:

• uncertainty
• vague statements
• hesitation

---

## 9. Close Quality

Measures how well the rep asks for the sale.

Types of closes:

• full close
• deposit
• payment plan
• partial access

Strong close includes:

• direct ask• clear explanation of options
• confidence

Weak close includes:

• avoiding the close
• awkward asking
• passive language

---

## 10. Urgency & Close

Measures whether the rep creates urgency.

Examples:

• price increase framing
• limited availability
• securing price with deposit

Weak urgency includes:

• none at all
• sounding fake or forced

---

# Outcome Classification

Each call must also have an outcome:

• closed
• deposit
• payment_plan
• partial_access
• follow_up
• no_sale

---

# Overall Score Calculation

The overall score is the weighted average of all categories.

Important weighting:

Pain Amplification 
Objection Handling 
Close Quality

These have the highest importance.

A call with strong rapport but poor closing should score lower.

---

# Strong Call Definition

A call is considered strong if:

• Overall score ≥ 75
• Close Quality ≥ 7
• Discovery ≥ 7

---

# Weak Call Definition

A call is weak if:

• Overall score < 60
OR
• Close Quality ≤ 4

---

# Coaching Extraction

If a call scores high in a category, extract the technique.

Examples:

• objection handling phrase
• discovery question
• value explanation

These should be sent to the learning queue.

---

# Hard Reject Patterns

The system must reject learning patterns that are:

• greetings
• rapport only
• generic filler phrases
• vague conversation

Only meaningful sales techniques should be learned.

---

# Key Principle

The AI must prioritise sales effectiveness over friendliness.

A call that is friendly but fails to close should not score highly.