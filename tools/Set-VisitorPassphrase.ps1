$ErrorActionPreference = 'Stop'
$secret = Read-Host 'New visitor-only passphrase (not an account password)' -AsSecureString
$pointer = [IntPtr]::Zero
$bytes = $null
$hasher = [System.Security.Cryptography.SHA256]::Create()
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($value)) { throw 'The visitor passphrase cannot be empty.' }
    if ($value.Length -gt 200) { throw 'Use at most 200 characters for the visitor passphrase.' }
    $bytes = [Text.Encoding]::UTF8.GetBytes($value)
    $digest = ([BitConverter]::ToString($hasher.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    $target = Join-Path (Split-Path $PSScriptRoot -Parent) 'config\visitor-gate.json'
    $json = "{`n  `"sha256`": `"$digest`"`n}`n"
    [IO.File]::WriteAllText($target, $json, (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Visitor verifier updated. Run npm.cmd run build to rebuild locally.'
    Write-Host 'This is a bypassable UI gate. All content and the verifier are public.'
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    $value = $null
    $secret.Dispose()
    $hasher.Dispose()
}
