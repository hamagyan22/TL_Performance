# Performance Dashboard

A modern, responsive web application performance dashboard connecting to a Supabase database.

## Prerequisites
- Node.js (v18 or higher)
- npm or yarn

## Setup Instructions

1. **Install dependencies**
   Open your terminal in this directory and run:
   ```bash
   npm install
   ```

2. **Run the development server**
   ```bash
   npm run dev
   ```

3. **Open the application**
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables
The `.env.local` file is already created with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Features
- Fully responsive design matching the provided "Team Lead Dashboard" screenshot.
- Connects to your `jan_exam_metrics` Supabase table.
- View KPIs, filter by Agent Name, and sort by Month tabs.
- Custom Tailwind UI implementation matching the requested color scheme.
