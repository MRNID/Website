$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$RootPath = (Get-Item "$PSScriptRoot\..").FullName

# 1. Shortcut: Ban Dong Goi
$ShortcutUser = $WshShell.CreateShortcut("$DesktopPath\PACKING PROOF - BAN DONG GOI.lnk")
$ShortcutUser.TargetPath = "http://localhost:3000"
$ShortcutUser.Description = "Màn hình đóng hàng cho nhân viên kho (Packing Station)"
$ShortcutUser.Save()

# 2. Shortcut: Quan Tri Kho
$ShortcutAdmin = $WshShell.CreateShortcut("$DesktopPath\PACKING PROOF - QUAN TRI KHO.lnk")
$ShortcutAdmin.TargetPath = "http://localhost:3001"
$ShortcutAdmin.Description = "Trang quản trị video, tra cứu đơn hàng & giải quyết khiếu nại"
$ShortcutAdmin.Save()

# 3. Shortcut: Khoi Dong He Thong
$ShortcutStart = $WshShell.CreateShortcut("$DesktopPath\KHOI DONG HE THONG PACKING.lnk")
$ShortcutStart.TargetPath = "$RootPath\scripts\start-all.bat"
$ShortcutStart.WorkingDirectory = "$RootPath"
$ShortcutStart.Description = "Khởi động toàn bộ Backend, Camera Dahua, User Web và Admin Web"
$ShortcutStart.Save()

Write-Host "Da tao thanh cong 3 shortcut tren Desktop cua ban!" -ForegroundColor Green
Write-Host "1. PACKING PROOF - BAN DONG GOI" -ForegroundColor Cyan
Write-Host "2. PACKING PROOF - QUAN TRI KHO" -ForegroundColor Cyan
Write-Host "3. KHOI DONG HE THONG PACKING" -ForegroundColor Yellow
