# docs/kb/tools/mappa_porte.ps1
#
# La meta' Windows di `mappa_porte.py`. Sta in un FILE e non inline, perche' un comando
# PowerShell con virgolette annidate profonde termina senza eseguire nulla E SENZA ERRORE
# — misurato qui: la sezione «windows» usciva vuota, e sembrava «nessuna porta occupata».
# E' la regola gia' scritta nel CLAUDE.md globale, violata e ri-pagata.
#
# Stampa una riga per porta:  <porta>|<processo>|<pid>

Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -ge 1024 -and $_.LocalPort -lt 20000 } |
  Select-Object -Property LocalPort, OwningProcess -Unique |
  Sort-Object LocalPort |
  ForEach-Object {
    $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    $nome = if ($p) { $p.ProcessName } else { '?' }
    "{0}|{1}|{2}" -f $_.LocalPort, $nome, $_.OwningProcess
  }
