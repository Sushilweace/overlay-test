# Examples

Question: Why is the login slow?
Answer:
- The check runs on every keystroke, so the page waits before you can continue.
- We should run it once, when the person leaves the field.
- Example: on the signup page, typing an email currently waits about a second after each letter.

Question: How would you explain this to the client?
Answer:
- We ship the small fix tomorrow, and the larger cleanup next week.
- Tomorrow unblocks their team. Next week stops it from coming back.
- Example: their morning report failed today because the login check timed out.
