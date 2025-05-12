from typing import Dict, List, Optional, Union
from models import User, InsertUser, Player, InsertPlayer, Skills, InsertSkills, Challenge, InsertChallenge

class IStorage:
    def get_user(self, id: int) -> Optional[User]:
        pass
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        pass
    
    def create_user(self, user: InsertUser) -> User:
        pass
    
    # Player related methods
    def get_players(self) -> List[Player]:
        pass
    
    def get_player(self, id: int) -> Optional[Player]:
        pass
    
    def create_player(self, player: InsertPlayer) -> Player:
        pass
    
    # Skills related methods
    def get_skills(self, player_id: int) -> Optional[Skills]:
        pass
    
    def create_skills(self, skills: InsertSkills) -> Skills:
        pass
    
    # Challenge related methods
    def get_challenges(self) -> List[Challenge]:
        pass
    
    def get_challenge(self, id: int) -> Optional[Challenge]:
        pass
    
    def create_challenge(self, challenge: InsertChallenge) -> Challenge:
        pass

class MemStorage(IStorage):
    def __init__(self):
        self.users = {}
        self.players_map = {}
        self.skills_map = {}
        self.challenges_map = {}
        self.current_user_id = 1
        self.current_player_id = 1
        self.current_skills_id = 1
        self.current_challenge_id = 1
        
        # Initialize with some data
        self.seed_data()
    
    def get_user(self, id: int) -> Optional[User]:
        return self.users.get(id)
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        for user in self.users.values():
            if user['username'] == username:
                return user
        return None
    
    def create_user(self, insert_user: InsertUser) -> User:
        id = self.current_user_id
        self.current_user_id += 1
        user = {**insert_user, 'id': id}
        self.users[id] = user
        return user
    
    # Player methods
    def get_players(self) -> List[Player]:
        return list(self.players_map.values())
    
    def get_player(self, id: int) -> Optional[Player]:
        return self.players_map.get(id)
    
    def create_player(self, insert_player: InsertPlayer) -> Player:
        id = self.current_player_id
        self.current_player_id += 1
        player = {**insert_player, 'id': id}
        self.players_map[id] = player
        return player
    
    # Skills methods
    def get_skills(self, player_id: int) -> Optional[Skills]:
        for skill in self.skills_map.values():
            if skill['playerId'] == player_id:
                return skill
        return None
    
    def create_skills(self, insert_skills: InsertSkills) -> Skills:
        id = self.current_skills_id
        self.current_skills_id += 1
        skill = {**insert_skills, 'id': id}
        self.skills_map[id] = skill
        return skill
    
    # Challenge methods
    def get_challenges(self) -> List[Challenge]:
        return list(self.challenges_map.values())
    
    def get_challenge(self, id: int) -> Optional[Challenge]:
        return self.challenges_map.get(id)
    
    def create_challenge(self, insert_challenge: InsertChallenge) -> Challenge:
        id = self.current_challenge_id
        self.current_challenge_id += 1
        challenge = {**insert_challenge, 'id': id}
        self.challenges_map[id] = challenge
        return challenge
    
    # Seed with initial data
    def seed_data(self):
        # Seed players
        players = [
            {
                "name": "David Beckham",
                "position": "Forward",
                "avatar": "https://pixabay.com/get/gbbd5ca28787cc9f142e2b9c388dd789b8415a3431c0abd3206570a5dc8b7248c679c3789f7ae618cafefac7fe68812a7ce2d5ecc7ebf99cbfeac38329e2d6047_1280.jpg",
                "wins": 42,
                "losses": 7,
                "trend": "up",
                "trendValue": "5.2%"
            },
            {
                "name": "Cristiano Ronaldo",
                "position": "Forward",
                "avatar": "https://images.unsplash.com/photo-1531361171768-37170e369163?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
                "wins": 38,
                "losses": 9,
                "trend": "down",
                "trendValue": "1.8%"
            },
            {
                "name": "Manuel Neuer",
                "position": "Goalkeeper",
                "avatar": "https://pixabay.com/get/g4a54daff6b69a1d2576d4b498e189e77909acadb6aeec0bec56cc14237ab33a3e14f58f6768fb040e1fa57945e82c54c8f7512a97009debf5684f6b0c72769d2_1280.jpg",
                "wins": 35,
                "losses": 10,
                "trend": "up",
                "trendValue": "3.5%"
            },
            {
                "name": "Lionel Messi",
                "position": "Forward",
                "avatar": "https://pixabay.com/get/g00102c2b37aa9e734b9a7bad9b3d2e9ba04f4f52e78c7eb879c6a1f48a0130de44e33497dde0be787d009a47b4e4d8f1355a3defb69225fb0736b8c12c7db209_1280.jpg",
                "wins": 32,
                "losses": 12,
                "trend": "stable",
                "trendValue": "0.1%"
            },
            {
                "name": "Sergio Ramos",
                "position": "Defender",
                "avatar": "https://pixabay.com/get/g7096cdcea98d10eeb11e203a32ea308c85010c2a9785786782ed20e6be9982cb42580865d682bf4fe26e2f60a1fa58a926804f49780f993641b9cfa160a4bf46_1280.jpg",
                "wins": 30,
                "losses": 15,
                "trend": "up",
                "trendValue": "2.1%"
            }
        ]

        # Create players in storage
        for player_data in players:
            id = self.current_player_id
            self.current_player_id += 1
            player = {**player_data, 'id': id}
            self.players_map[id] = player
            
            # Add goalkeeper skills for Manuel Neuer
            if player_data["name"] == "Manuel Neuer":
                skills_data = {
                    "playerId": id,
                    "reflexes": 95,
                    "positioning": 88,
                    "oneOnOnes": 92,
                    "commandOfArea": 90,
                    "distribution": 85,
                    "handling": 87
                }
                
                skills_id = self.current_skills_id
                self.current_skills_id += 1
                skills = {**skills_data, 'id': skills_id}
                self.skills_map[skills_id] = skills
        
        # Seed challenges
        challenges = [
            {
                "title": "Weekend Tournament",
                "image": "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=280",
                "status": "days_left",
                "statusValue": "3 days left",
                "participants": 24,
                "location": "Central Stadium",
                "prize": "$500 prize pool",
                "theme": "primary"
            },
            {
                "title": "Goalkeeper Showdown",
                "image": "https://images.unsplash.com/photo-1522778119026-d647f0596c20?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=280",
                "status": "ongoing",
                "statusValue": "Ongoing",
                "participants": 12,
                "location": "Training Grounds",
                "prize": "Custom Gloves Prize",
                "theme": "secondary"
            },
            {
                "title": "Penalty Shootout",
                "image": "https://pixabay.com/get/g951c406f059e5f4f477332be086473261534d8ee25fc8bb9341979a88cb2938fd8da6cf3b7fe9e1afba39ad9589b26c41b999e9bf240e7242e182ae2b5c875f1_1280.jpg",
                "status": "days_left",
                "statusValue": "1 week left",
                "participants": 32,
                "location": "Multiple Locations",
                "prize": "Champion Title + Trophy",
                "theme": "accent"
            }
        ]
        
        # Create challenges in storage
        for challenge_data in challenges:
            id = self.current_challenge_id
            self.current_challenge_id += 1
            challenge = {**challenge_data, 'id': id}
            self.challenges_map[id] = challenge

# Tạo instance của storage để sử dụng
storage = MemStorage()