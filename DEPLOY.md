# Deploy หนีฝน AI ให้รัน 24 ชม. ฟรี (ไม่ต้องเปิดคอม)

เป้าหมาย: ระบบเก็บข้อมูล + ทำนายทำงานตลอด 24 ชม. แม้ปิดคอม และเปิดดูบนมือถือจากที่ไหนก็ได้ — **ฟรี**

## ทำไมต้องเป็น "VM ฟรี" ไม่ใช่ host กดปุ่มเดียว
- Render / Railway ฟรี → **หลับเมื่อไม่มีคนเข้า** (collector หยุด = ข้อมูลขาด) และ **ไม่มีดิสก์ถาวร** (ข้อมูลหาย)
- VM ฟรีถาวร = เครื่อง Linux จริงที่เปิดตลอด รันได้ทุกฟังก์ชัน เก็บข้อมูลต่อเนื่อง

## ตัวเลือก VM ฟรีถาวร (เลือก 1)
| ผู้ให้บริการ | สเปคฟรี | หมายเหตุ |
|---|---|---|
| **Oracle Cloud — Always Free** (แนะนำ) | ARM สูงสุด 4 คอร์/24GB RAM **หรือ** AMD micro 1GB ×2 | ฟรีถาวร แรงสุด · บางครั้ง ARM เต็ม ให้เลือก AMD micro แทน |
| **Google Cloud — Always Free** | e2-micro 1GB (เฉพาะรีเจี้ยน US) | ฟรีถาวร · ดีเลย์มาไทยนิดหน่อย (ไม่กระทบ dashboard) |

ทั้งคู่: สมัครต้องผูกบัตร (เพื่อยืนยันตัวตน — **ไม่ถูกตัดเงิน**ถ้าใช้เฉพาะ Always Free)

---

## ขั้นตอน (Oracle/GCP Ubuntu VM)

### 1) สร้าง VM
- เลือก Ubuntu 22.04, รูปแบบ Always Free
- เปิดพอร์ต: ในหน้า network/firewall ของคลาวด์ อนุญาต **TCP 3000** (และ 22 สำหรับ SSH)

### 2) ติดตั้ง Node + เครื่องมือ (รันบน VM ผ่าน SSH)
```bash
sudo apt update && sudo apt install -y git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# VM 1GB ควรเพิ่ม swap กัน build แล้ว RAM หมด
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3) เอาโค้ดขึ้น + build
```bash
# วิธี A: ผ่าน GitHub (push โปรเจกต์ขึ้น repo ก่อน แล้ว clone)
git clone <your-repo-url> neefon && cd neefon/app

# วิธี B: อัปโหลดโฟลเดอร์ app/ ขึ้น VM ด้วย scp (ไม่ต้องมี GitHub)

npm ci
npm run db:setup        # สร้างตาราง DB
npm run build
```

### 4) (ทางเลือก) ย้ายข้อมูลเดิม
อยากเก็บประวัติเดิม (~3,700 readings) ให้ copy ไฟล์ `app/data/rain.db` จากคอมขึ้น VM ที่ `neefon/app/data/rain.db` (ใช้ scp)

### 5) รันแบบถาวรด้วย pm2
```bash
cd ~/neefon/app
PORT=3000 NODE_ENV=production pm2 start "npm run start" --name neefon
pm2 save
pm2 startup        # ทำตามคำสั่งที่มันพิมพ์ออกมา (ให้รีสตาร์ทเองเมื่อ VM รีบูต)
```
เปิดดู: `http://<public-ip-ของ-VM>:3000`

### 6) (ทางเลือก) เปิดบนมือถือแบบ https สวยๆ ไม่ต้องเปิดพอร์ต
ติดตั้ง **Cloudflare Tunnel** (ฟรี) → ได้ลิงก์ `https://xxx.trycloudflare.com` เข้าจากมือถือได้เลย:
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
cloudflared tunnel --url http://localhost:3000
```

---

## หลัง deploy: ใส่ API Keys
เข้าหน้าเว็บ → Settings → ใส่ OWM/Windy/Gemini keys (เก็บใน DB บน VM) → collector เริ่มเก็บข้อมูลเอง 24 ชม. ทันที

## อัปเดตโค้ดในอนาคต
```bash
cd ~/neefon/app && git pull && npm ci && npm run build && pm2 restart neefon
```
