#!/bin/bash

# Add current user to docker group (if exists)
if getent group docker > /dev/null 2>&1; then
    echo "Adding user '$USER' to the 'docker' group..."
    sudo usermod -aG docker $USER
    echo "Done. Please log out and log back in (or run: newgrp docker)"
else
    echo "Creating 'docker' group and adding user '$USER'..."
    sudo groupadd docker
    sudo usermod -aG docker $USER
    echo "Done. Please log out and log back in (or run: newgrp docker)"
fi

# Start docker service if not running
if ! sudo systemctl is-active --quiet docker; then
    echo "Starting Docker service..."
    sudo systemctl start docker
fi

# Enable Docker on boot
echo "Enabling Docker on boot..."
sudo systemctl enable docker

echo ""
echo "You can now run 'docker compose up -d' without sudo."
