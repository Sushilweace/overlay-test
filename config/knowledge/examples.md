# Examples of How I Answer (English & Hinglish)

## Example 1: Request Lifecycle in Microservices
- Question: "How does your API gateway communicate with internal microservices?"
- English Answer:
  "In WeAce, only our NestJS API Gateway exposes HTTP to the public. All internal services like Auth, User, and Coaching are headless TCP microservices. When a request comes in, our Gateway guard validates the JWT token with Auth service over TCP, checks RBAC permissions against User service, and then forwards the payload to the Coaching service using NestJS ClientProxy. This keeps internal services completely isolated and secure."
- Hinglish Answer:
  "Humare WeAce project me sirf NestJS API Gateway public HTTP expose karta hai. Baaki saari internal services jaise Auth, User aur Coaching headless TCP microservices hain. Jab koi request aati hai, Gateway ka guard pehle TCP message ke through token verify karta hai, permission slugs check karta hai, aur phir ClientProxy use karke target service ko payload bhej deta hai. Isse internal services internet se completely secure rehti hain."

## Example 2: Handling Token Expiry
- Question: "How do you handle token expiration without interrupting the user?"
- English Answer:
  "We implemented a transparent background auto-refresh in our JwtAuthGuard. The client sends both the access token and a refresh token header. If the access token expires mid-session, instead of failing with a 401, the guard catches the error, calls Cognito via our Auth service to issue a new access token, updates the request headers on the fly, and lets the request finish. The frontend receives the new token in the response headers."
- Hinglish Answer:
  "Humne JwtAuthGuard ke andar transparent auto-refresh mechanism implement kiya hai. Client access token ke sath x-refresh-token header bhejta hai. Agar access token expire hota hai, toh guard 401 throw karne ke bajaye background me Auth service ko call karta hai, AWS Cognito se naya token fetch karke request headers me re-attach kar deta hai. Isse user session kabhi interrupt nahi hota."

## Example 3: Large Bulk Uploads / Async Jobs
- Question: "How do you prevent timeouts when uploading thousands of users?"
- English Answer:
  "When corporate admins upload 2,000 to 3,000 mentees, a synchronous endpoint would hit a 504 timeout and choke the connection pool. We designed an asynchronous chunked pipeline: if the batch is over 50 rows, we create a job in MongoDB and immediately return HTTP 202 Accepted with a job ID. A worker processes the mentees in batches of 50, updating progress so the frontend can poll cleanly."
- Hinglish Answer:
  "Pehle jab corporate clients 2,000–3,000 mentees ek sath upload karte the, toh 504 Gateway Timeout ho jata tha aur DB connection pool exhaust ho jata tha. Isko solve karne ke liye humne async chunked processing banayi. Agar batch 50 se zyada records ka hai, toh hum MongoDB me job entry banakar 2 second me HTTP 202 Accepted return kar dete hain. Background me 50-50 ke batches process hote hain aur frontend status poll kar leta hai."
