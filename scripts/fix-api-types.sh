#!/bin/bash

# Fix all 'any' types in catch blocks across API routes
find app/api -name "*.ts" -type f -exec sed -i '' 's/} catch (error: any) {/} catch (error) {/g' {} \;

# Fix NextRequest imports that are not used
find app/api -name "*.ts" -type f -exec sed -i '' 's/import { NextResponse, NextRequest } from/import { NextResponse } from/g' {} \;

# Update error handling to use proper type assertion
find app/api -name "*.ts" -type f -exec sed -i '' 's/error\.message || /\(error as Error\)\.message || /g' {} \;

echo "Fixed API route types"