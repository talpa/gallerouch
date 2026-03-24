# Vypíše všechny soubory ve frontend/src
Write-Host "Obsah složky frontend/src:"
Get-ChildItem -Path .\frontend\src -Recurse

# Zkontroluje, zda jsou soubory opravdu čitelné
$files = @("store.ts", "App.tsx", "i18n.ts")
foreach ($file in $files) {
    $path = ".\frontend\src\$file"
    if (Test-Path $path) {
        Write-Host "$file existuje."
        Get-Content $path -First 5
    } else {
        Write-Host "$file CHYBÍ!"
    }
}

# Vypíše obsah .dockerignore
Write-Host "`nObsah .dockerignore:"
Get-Content .\frontend\.dockerignore

# Vypíše obsah Dockerfile
Write-Host "`nObsah Dockerfile:"
Get-Content .\frontend\Dockerfile