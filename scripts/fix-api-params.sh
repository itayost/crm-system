#!/bin/bash

# Fix all API routes with [id] params to use async params

# Fix leads routes
sed -i '' 's/const leadId = params\.id as string/const { id: leadId } = await params/g' app/api/leads/\[id\]/route.ts

# Fix projects routes
sed -i '' 's/const projectId = params\.id as string/const { id: projectId } = await params/g' app/api/projects/\[id\]/route.ts

# Fix payments routes
sed -i '' 's/const paymentId = params\.id as string/const { id: paymentId } = await params/g' app/api/payments/\[id\]/route.ts
sed -i '' 's/const recurringPaymentId = params\.id as string/const { id: recurringPaymentId } = await params/g' app/api/payments/recurring/\[id\]/route.ts

# Fix tasks routes
sed -i '' 's/const taskId = params\.id as string/const { id: taskId } = await params/g' app/api/tasks/\[id\]/route.ts

# Fix time routes
sed -i '' 's/const entryId = params\.id as string/const { id: entryId } = await params/g' app/api/time/\[id\]/route.ts

echo "Fixed all API route params to use async/await"