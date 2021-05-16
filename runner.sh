docker build -t comments-auth . 
docker rm -f commentsAuth
docker run -it -d -p 8081:8081 --restart=always --log-opt max-size=10k --log-opt max-file=1 --name=commentsAuth  comments-auth:latest
