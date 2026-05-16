param(
  [Parameter(Mandatory=$true)]
  [string]$Target
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApplyPy = Join-Path $ScriptDir "apply_bundle.py"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "Python is required. Install Python or run scripts/apply_bundle.py manually with python3."
  exit 1
}

python $ApplyPy --target $Target
