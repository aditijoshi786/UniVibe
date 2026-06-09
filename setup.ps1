# UniVibe - One-time setup script
Write-Host "Setting up UniVibe..." -ForegroundColor Cyan

Write-Host "`n[1/2] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..

Write-Host "`n[2/2] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
Write-Host "`nPushing database schema to Supabase..." -ForegroundColor Yellow
npx prisma db push
Set-Location ..

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "To start the app, open two terminals and run:" -ForegroundColor White
Write-Host "  Terminal 1 (frontend): cd frontend && npm run dev" -ForegroundColor Cyan
Write-Host "  Terminal 2 (backend):  cd backend  && npm run dev" -ForegroundColor Cyan
