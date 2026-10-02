# One-time: allow Windows host -> WSL2 inbound on Postgres (5432) & Redis (6379).
# Required because the Hyper-V firewall blocks inbound to the WSL VM by default
# even in mirrored networking mode. Scoped to the WSL VM creator id + these ports.
# Run elevated (the launcher uses Start-Process -Verb RunAs).

$ErrorActionPreference = 'Stop'
$log = 'D:\Projects\APII Jabo\APII Jabo Apps\scripts\.wsl-firewall.log'
$vmId = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'

"=== run $(Get-Date -Format o) ===" | Out-File -FilePath $log -Encoding utf8

try {
    foreach ($p in 5432, 6379) {
        $name = "WSL-Dev-$p"
        Get-NetFirewallHyperVRule -Name $name -ErrorAction SilentlyContinue | Remove-NetFirewallHyperVRule -ErrorAction SilentlyContinue
        New-NetFirewallHyperVRule -Name $name -DisplayName "WSL2 dev port $p (SIAP APII)" -Direction Inbound -VMCreatorId $vmId -Protocol TCP -LocalPorts $p -Action Allow | Out-Null
        "created rule: $name" | Out-File -FilePath $log -Encoding utf8 -Append
    }
    Set-NetFirewallHyperVVMSetting -Name $vmId -DefaultInboundAction Allow
    "set DefaultInboundAction=Allow for WSL VM firewall" | Out-File -FilePath $log -Encoding utf8 -Append
    "SUCCESS" | Out-File -FilePath $log -Encoding utf8 -Append
    Get-NetFirewallHyperVVMSetting | Select-Object Name, DefaultInboundAction, Enabled | Out-File -FilePath $log -Encoding utf8 -Append
    Get-NetFirewallHyperVRule -Name 'WSL-Dev-*' | Select-Object Name, DisplayName, Direction, Action, LocalPorts | Out-File -FilePath $log -Encoding utf8 -Append
}
catch {
    "ERROR: $($_.Exception.Message)" | Out-File -FilePath $log -Encoding utf8 -Append
}

Start-Sleep -Seconds 2
