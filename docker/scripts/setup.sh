#!/bin/bash

echo "*************************************************************************************************";
echo "*                              ___             ___     __  _                                    *";
echo "*                             / _ \_______ ___/ (_)___/ /_(_)  _____                            *";
echo "*                            / ___/ __/ -_) _  / / __/ __/ / |/ / -_)                           *";
echo "*                           /_/  /_/  \__/\_,_/_/\__/\__/_/|___/\__/                            *";
echo "*                              __  ___                            __                            *";
echo "*                             /  |/  /__ _  _____ __ _  ___ ___  / /_                           *";
echo "*                            / /|_/ / _ \ |/ / -_)  ' \/ -_) _ \/ __/                           *";
echo "*                           /_/  /_/\___/___/\__/_/_/_/\__/_//_/\__/                            *";
echo "*                                                                                               *";
echo "*                                                                                               *";
echo "*                                  Luleå Tekniska Universitet                                   *";
echo "*                                    johanna.lindberg@ltu.se                                    *";
echo "*                                                                                               *";
echo "*************************************************************************************************";
echo "";


function print_asterisks {

    echo "";
    num_asterisks=1

    # Infinite loop to print a growing line of asterisks
    while [ "$num_asterisks" -le "97" ] ; do
        
        printf "%${num_asterisks}s" | tr ' ' '*';  
        printf "\r";
        ((num_asterisks++));  
        sleep ${1};
        
    done
    echo ""; echo "";

}                        

# Check docker version
if docker --version > /dev/null; then
    docker --version; echo "";
else
    echo "No installation of docker has been detected";
    echo " --> https://www.docker.com/"; echo ""; exit 1;
fi

# Check docker-compose version
if docker-compose --version > /dev/null; then
    docker-compose --version; echo "";
else
    echo "No installation of docker-compose has been detected"
    echo " --> https://docs.docker.com/compose/"; echo "";  exit 1;
fi

# Download necessary Docker images
echo "*** Downloading Docker Images..."; echo "";

# Requirements 
docker image pull 'busybox:latest'; echo "";
docker image pull 'pelias/elasticsearch:7.5.1'; echo "";

# Dependencies
docker image pull 'pelias/api:v5.54.0'; echo "";
docker image pull 'pelias/schema:v6.4.0'; echo "";
docker image pull 'pelias/dashboard:master'; echo "";
docker image pull 'pelias/pip-service:master'; echo "";
docker image pull 'pelias/openstreetmap:master'; echo "";
docker image pull 'pelias/libpostal-service:master'; echo "";
docker image pull 'fernand0labra/otp-sweden:latest'; echo "";
docker image pull 'docker.elastic.co/kibana/kibana:7.5.1'; echo "";
docker image pull 'vroomvrp/vroom-docker:v1.11.0'; echo "";
docker image pull 'fernand0labra/osrm-sweden:latest'; echo "";

# Digital-twin
docker image pull fernand0labra/sample-address:latest; echo "";
docker image pull fernand0labra/digital-twin-simulator:latest; echo "";
docker image pull fernand0labra/digital-twin-visualisation:latest; echo ""; echo ""; 

# Setup requirements for dependencies and digital-twin
echo "*** Setting up Requirements..."; echo "";
docker-compose --log-level ERROR --file ../docker-compose-reqs.yaml up --detach;
print_asterisks 0.2

# Setup dependencies for digital-twin
echo "*** Setting up Dependencies..."; echo "";
docker-compose --log-level ERROR --file ../docker-compose-deps.yaml up --detach;
print_asterisks 0.2

# Setup digital-twin
# echo "*** Setting up Digital-Twin..."; echo "";
# docker-compose --log-level ERROR --file ../docker-compose-twin.yaml up --detach;
# print_asterisks 0.2


echo "*************************************************************************************************";
echo "*                                                                                               *";
echo "*                             All Done! Thank you for the patience                              *";
echo "*              You can access the simulation by typing 'localhost' on your browser              *";
echo "*                                                                                               *";
echo "*************************************************************************************************";
echo "*                                                             _________________________         *";
echo "*                        /\\      _____          _____       |   |     |     |    | |  \         *";
echo "*         ,-----,       /  \\____/__|__\_    ___/__|__\___   |___|_____|_____|____|_|___\        *";
echo "*      ,--'---:---\`--, /  |  _     |     \`| |      |      \`| |                    | |    \      *";
echo "*     ==(o)-----(o)==J    \`(o)-------(o)=   \`(o)------(o)'   \`--(o)(o)--------------(o)--'      *";
echo "*    \`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`\`      *";
echo "*                                                                                               *";
echo "*************************************************************************************************";