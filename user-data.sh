#!/bin/bash
set -x

# Actualizar el sistema
sudo apt-get update
sudo apt-get upgrade -y

# Instalar Python y dependencias
sudo apt-get install -y python3 python3-pip git

# Clonar tu repositorio Nexa-Bot
cd /home/ubuntu
git clone https://github.com/gonzalopriv92-code/Nexa-Bot.git
cd Nexa-Bot

# Instalar dependencias de Python
pip install -r requirements.txt

# Iniciar el bot (ajusta según tu configuración)
python3 main.py &
