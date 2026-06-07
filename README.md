# Twitch Orders Collector

## Requirements

- A Twitch bot account 

## Installation
Create or use your personal account as bot:
- Go to https://dev.twitch.tv/
- Sign up or log in (you can use a new dedicated account no need to use the main account)
- Go to Applications
  - <img width="248" height="318" alt="image" src="https://github.com/user-attachments/assets/53756ab7-0c29-480c-81ac-113fa41e7af9" />
- Register your application
  - <img width="249" height="66" alt="image" src="https://github.com/user-attachments/assets/48d00377-9599-4649-afce-3b2c56356c37" />
- Fill your data
  - <img width="781" height="678" alt="image" src="https://github.com/user-attachments/assets/a3fc4746-fd69-4080-9f04-116524983ef1" />
- Click on manage
  - <img width="453" height="109" alt="image" src="https://github.com/user-attachments/assets/4e4b6063-0141-4b61-bff9-91bb539b99ac" />
- Create a new secret and copy it (it wont be avaliable anymore once the page is refreshed), copy the client id too
  - <img width="658" height="141" alt="image" src="https://github.com/user-attachments/assets/148abd77-1267-4d4d-9415-034a59defd90" />
  - <img width="948" height="143" alt="image" src="https://github.com/user-attachments/assets/f2469e72-1fc5-4609-ab99-22cfef690527" />
- Open the application and go to settigns (download it from the release section https://github.com/Zophirel/TwitchOrdersCollector/releases)
  - <img width="1466" height="944" alt="image" src="https://github.com/user-attachments/assets/21242a38-cc52-46ef-aeed-a45e99220496" />
- Paste the info from the twitch dashboard to the app settings inputs
  - <img width="1108" height="270" alt="image" src="https://github.com/user-attachments/assets/cbd5974e-e677-4ec2-ada0-fea2c9804c6d" />
  - <img width="397" height="133" alt="image" src="https://github.com/user-attachments/assets/b4176a38-a5ed-4eeb-acff-76db876cf061" />
  - <img width="582" height="690" alt="image" src="https://github.com/user-attachments/assets/8d0037d4-f369-4919-abda-d31e70f53cd5" />
- Fill the data of the channel where the bot has to connect to
  <img width="1071" height="506" alt="image" src="https://github.com/user-attachments/assets/9f4779c6-3a4e-448f-ab51-ba0801f81f05" />
  (trigger word is the command use to fetch user order request, order trigger word is used to fetch the order confirmation by user)
- Test the connection and start the bot
  <img width="1099" height="185" alt="image" src="https://github.com/user-attachments/assets/6c971733-441e-4368-883a-977dadd6836e" />

## Usage
After setting up the bot and the keywords the user has to request the article by using `!reqeuest <object name>` like `!request Onepiece luffy` and to confirm the request `!order <object name> <price>` like `!order onepiece luffy 20`
