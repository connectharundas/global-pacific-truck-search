# Deploying to a Hostinger VPS

## 1. Provision the server

- In hPanel, create a **KVM VPS** (Ubuntu 22.04).
- Note the server's public IP.
- Point your domain's **A record** at that IP (if using a custom domain).

## 2. Initial server setup (as root, via SSH)

```bash
apt update && apt upgrade -y
apt install -y python3-venv python3-pip nginx mysql-server git ufw

# Firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable

# Create a non-root deploy user
adduser deploy
usermod -aG sudo deploy
```

Log out and back in as `deploy` for the rest.

## 3. Secure MySQL and create the app database

```bash
sudo mysql_secure_installation

sudo mysql -u root -p
```

```sql
CREATE DATABASE truckdb CHARACTER SET utf8mb4;
CREATE USER 'truckuser'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON truckdb.* TO 'truckuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 4. Deploy the code

```bash
cd ~
git clone <your-repo-url> app
cd app

python3 -m venv venv
venv/bin/pip install -r requirements.txt

cp .env.example .env
nano .env   # fill in DATABASE_URL, ADMIN_PASSWORD, SECRET_KEY with real values
chmod 600 .env
```

`.env` on the server should look like:

```
DATABASE_URL=mysql+pymysql://truckuser:REPLACE_WITH_STRONG_PASSWORD@localhost/truckdb
ADMIN_PASSWORD=<pick something strong>
SECRET_KEY=<random 32+ char string>
```

## 5. Load the initial dataset

```bash
venv/bin/python scripts/migrate_excel_to_db.py
```

This creates the tables and imports `data/sampledata.xlsx` once. After this, use the `/admin/upload` page for future data updates — the Excel file itself is no longer read by the running app.

## 6. Run the app as a service

```bash
sudo cp deploy/gunicorn.service /etc/systemd/system/gunicorn.service
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn
sudo systemctl status gunicorn
```

## 7. Put nginx in front

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/truckapp
sudo nano /etc/nginx/sites-available/truckapp   # replace YOUR_DOMAIN_HERE
sudo ln -s /etc/nginx/sites-available/truckapp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 8. Enable HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renews via a systemd timer it installs.

## 9. Verify

- Visit `https://yourdomain.com/health` — should report `"database": "connected"`.
- Visit `https://yourdomain.com/admin/login`, log in, and upload a new `.xlsx` to confirm the full flow works in production.

## Ongoing deploys

For future code changes:

```bash
cd ~/app
git pull
venv/bin/pip install -r requirements.txt   # if requirements changed
sudo systemctl restart gunicorn
```
