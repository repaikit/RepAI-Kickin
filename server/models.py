from typing import Dict, List, Optional, TypedDict, Union

# User models
class InsertUser(TypedDict):
    username: str
    password: str

class User(InsertUser):
    id: int

# Player models
class InsertPlayer(TypedDict):
    name: str
    position: str
    avatar: str
    wins: int
    losses: int
    trend: str
    trendValue: str

class Player(InsertPlayer):
    id: int

# Skills models
class InsertSkills(TypedDict):
    playerId: int
    reflexes: int
    positioning: int
    oneOnOnes: int
    commandOfArea: int
    distribution: int
    handling: int

class Skills(InsertSkills):
    id: int

# Challenge models
class InsertChallenge(TypedDict):
    title: str
    image: str
    status: str
    statusValue: str
    participants: int
    location: str
    prize: str
    theme: str

class Challenge(InsertChallenge):
    id: int