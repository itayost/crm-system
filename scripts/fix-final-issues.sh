#!/bin/bash

# Fix all 'any' types in service files
find lib/services -name "*.ts" -exec sed -i '' 's/:.*any\>/: unknown/g' {} \;
find lib/services -name "*.ts" -exec sed -i '' 's/(error: any)/(error)/g' {} \;

# Fix all 'any' types in components
find components -name "*.tsx" -exec sed -i '' 's/:.*any)/: unknown)/g' {} \;
find components -name "*.tsx" -exec sed -i '' 's/:.*any\>/: unknown/g' {} \;
find components -name "*.tsx" -exec sed -i '' 's/(error: any)/(error)/g' {} \;

# Fix the remaining any types in lib/api
sed -i '' 's/:.*any\>/: unknown/g' lib/api/api-handler.ts

# Remove more unused imports
find app/\(dashboard\) -name "*.tsx" -exec sed -i '' 's/import.*from.*date-fns.*//g' {} \;
find lib/services -name "*.ts" -exec sed -i '' 's/import.*from.*date-fns.*//g' {} \;

# Clean up empty import lines
find app -name "*.tsx" -type f -exec sed -i '' '/^$/N;/^\n$/d' {} \;
find lib -name "*.ts" -type f -exec sed -i '' '/^$/N;/^\n$/d' {} \;

echo "Fixed final issues"