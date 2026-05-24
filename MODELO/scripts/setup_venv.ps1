# Crea .venv en MODELO e instala dependencias (Windows)
# Uso: .\scripts\setup_venv.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    Write-Error "No se encontró 'py'. Instala Python 3.11+ desde https://www.python.org/downloads/ (marca 'Add to PATH')."
}

if (-not (Test-Path ".venv")) {
    Write-Host "Creando .venv con Python 3..."
    py -3 -m venv .venv
}

Write-Host "Instalando dependencias (paper + modelo)..."
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-paper.txt

Write-Host ""
Write-Host "Listo. Activa el entorno:"
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host ""
Write-Host "Generar figuras:"
Write-Host "  python scripts\generate_paper_figures.py --quick"
Write-Host "  python scripts\generate_paper_figures.py          # incluye curva de aprendizaje"
