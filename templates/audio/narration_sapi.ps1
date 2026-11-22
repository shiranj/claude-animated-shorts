# Placeholder narration with the free Windows voice (System.Speech). One WAV per line: <outdir>\<id>.wav (48 kHz, mono).
# Usage: powershell -NoProfile -File narration_sapi.ps1 <audio.json> <outdir> [rate -10..10, default 2]
# These files are placeholders. To use a real voice, record each line and save it under the same name.
param([Parameter(Mandatory = $true)][string]$Json, [Parameter(Mandatory = $true)][string]$OutDir, [int]$Rate = 2)
Add-Type -AssemblyName System.Speech
$spec = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
New-Item -ItemType Directory -Force $OutDir | Out-Null
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$names = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($names -contains $spec.voice) { $s.SelectVoice($spec.voice) } else { Write-Host "Voice '$($spec.voice)' not installed; using '$($s.Voice.Name)'." }
$s.Rate = $Rate
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($n in $spec.narration) {
  $path = Join-Path (Resolve-Path $OutDir) "$($n.id).wav"
  $s.SetOutputToWaveFile($path, $fmt); $s.Speak($n.text); $s.SetOutputToNull()
  Write-Host "$($n.id): $path"
}
$s.Dispose()
