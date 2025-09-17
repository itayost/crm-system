#!/bin/bash

# Fix projects page
sed -i '' 's/ArrowRight,//g' app/\(dashboard\)/projects/page.tsx
sed -i '' 's/:.*any\[\]/: Array<unknown>/g' app/\(dashboard\)/projects/page.tsx
sed -i '' 's/: any)/: unknown)/g' app/\(dashboard\)/projects/page.tsx
sed -i '' 's/(error)/()/g' app/\(dashboard\)/projects/page.tsx
sed -i '' "s/const mockProjects/\/\/ const mockProjects/g" app/\(dashboard\)/projects/page.tsx

# Fix reports page
sed -i '' "s/import { Button } from/\/\/ import { Button } from/g" app/\(dashboard\)/reports/page.tsx
sed -i '' "s/Users,//g" app/\(dashboard\)/reports/page.tsx
sed -i '' 's/:.*any\>/: unknown/g' app/\(dashboard\)/reports/page.tsx

# Fix tasks page
sed -i '' "s/, Pause//g" app/\(dashboard\)/tasks/page.tsx
sed -i '' 's/:.*any\[\]/: Array<unknown>/g' app/\(dashboard\)/tasks/page.tsx
sed -i '' 's/:.*any)/: unknown)/g' app/\(dashboard\)/tasks/page.tsx

# Fix time page
sed -i '' "s/Clock,//g" app/\(dashboard\)/time/page.tsx
sed -i '' "s/Calendar,//g" app/\(dashboard\)/time/page.tsx
sed -i '' "s/TrendingUp,//g" app/\(dashboard\)/time/page.tsx
sed -i '' "s/Target,//g" app/\(dashboard\)/time/page.tsx
sed -i '' "s/import api from/\/\/ import api from/g" app/\(dashboard\)/time/page.tsx
sed -i '' 's/:.*any\>/: unknown/g' app/\(dashboard\)/time/page.tsx
sed -i '' "s/, index//g" app/\(dashboard\)/time/page.tsx

# Fix settings page
sed -i '' 's/(error)/()/g' app/\(dashboard\)/settings/whatsapp/page.tsx

echo "Fixed remaining dashboard pages"