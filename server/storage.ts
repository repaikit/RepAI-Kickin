import { 
  users, type User, type InsertUser,
  players, type Player, type InsertPlayer,
  skills, type Skills, type InsertSkills,
  challenges, type Challenge, type InsertChallenge
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Player related methods
  getPlayers(): Promise<Player[]>;
  getPlayer(id: number): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  
  // Skills related methods
  getSkills(playerId: number): Promise<Skills | undefined>;
  createSkills(skills: InsertSkills): Promise<Skills>;
  
  // Challenge related methods
  getChallenges(): Promise<Challenge[]>;
  getChallenge(id: number): Promise<Challenge | undefined>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private playersMap: Map<number, Player>;
  private skillsMap: Map<number, Skills>;
  private challengesMap: Map<number, Challenge>;
  currentUserId: number;
  currentPlayerId: number;
  currentSkillsId: number;
  currentChallengeId: number;

  constructor() {
    this.users = new Map();
    this.playersMap = new Map();
    this.skillsMap = new Map();
    this.challengesMap = new Map();
    this.currentUserId = 1;
    this.currentPlayerId = 1;
    this.currentSkillsId = 1;
    this.currentChallengeId = 1;
    
    // Initialize with some data
    this.seedData();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Player methods
  async getPlayers(): Promise<Player[]> {
    return Array.from(this.playersMap.values());
  }
  
  async getPlayer(id: number): Promise<Player | undefined> {
    return this.playersMap.get(id);
  }
  
  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = this.currentPlayerId++;
    const player: Player = { ...insertPlayer, id };
    this.playersMap.set(id, player);
    return player;
  }
  
  // Skills methods
  async getSkills(playerId: number): Promise<Skills | undefined> {
    return Array.from(this.skillsMap.values()).find(
      (skill) => skill.playerId === playerId
    );
  }
  
  async createSkills(insertSkills: InsertSkills): Promise<Skills> {
    const id = this.currentSkillsId++;
    const skill: Skills = { ...insertSkills, id };
    this.skillsMap.set(id, skill);
    return skill;
  }
  
  // Challenge methods
  async getChallenges(): Promise<Challenge[]> {
    return Array.from(this.challengesMap.values());
  }
  
  async getChallenge(id: number): Promise<Challenge | undefined> {
    return this.challengesMap.get(id);
  }
  
  async createChallenge(insertChallenge: InsertChallenge): Promise<Challenge> {
    const id = this.currentChallengeId++;
    const challenge: Challenge = { ...insertChallenge, id };
    this.challengesMap.set(id, challenge);
    return challenge;
  }
  
  // Seed with initial data
  private seedData() {
    // Seed players
    const players: InsertPlayer[] = [
      {
        name: "David Beckham",
        position: "Forward",
        avatar: "https://pixabay.com/get/gbbd5ca28787cc9f142e2b9c388dd789b8415a3431c0abd3206570a5dc8b7248c679c3789f7ae618cafefac7fe68812a7ce2d5ecc7ebf99cbfeac38329e2d6047_1280.jpg",
        wins: 42,
        losses: 7,
        trend: "up",
        trendValue: "5.2%"
      },
      {
        name: "Cristiano Ronaldo",
        position: "Forward",
        avatar: "https://images.unsplash.com/photo-1531361171768-37170e369163?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        wins: 38,
        losses: 9,
        trend: "down",
        trendValue: "1.8%"
      },
      {
        name: "Manuel Neuer",
        position: "Goalkeeper",
        avatar: "https://pixabay.com/get/g4a54daff6b69a1d2576d4b498e189e77909acadb6aeec0bec56cc14237ab33a3e14f58f6768fb040e1fa57945e82c54c8f7512a97009debf5684f6b0c72769d2_1280.jpg",
        wins: 35,
        losses: 10,
        trend: "up",
        trendValue: "3.5%"
      },
      {
        name: "Lionel Messi",
        position: "Forward",
        avatar: "https://pixabay.com/get/g00102c2b37aa9e734b9a7bad9b3d2e9ba04f4f52e78c7eb879c6a1f48a0130de44e33497dde0be787d009a47b4e4d8f1355a3defb69225fb0736b8c12c7db209_1280.jpg",
        wins: 32,
        losses: 12,
        trend: "stable",
        trendValue: "0.1%"
      },
      {
        name: "Sergio Ramos",
        position: "Defender",
        avatar: "https://pixabay.com/get/g7096cdcea98d10eeb11e203a32ea308c85010c2a9785786782ed20e6be9982cb42580865d682bf4fe26e2f60a1fa58a926804f49780f993641b9cfa160a4bf46_1280.jpg",
        wins: 30,
        losses: 15,
        trend: "up",
        trendValue: "2.1%"
      }
    ];

    // Create players in storage
    players.forEach(player => {
      const id = this.currentPlayerId++;
      const newPlayer: Player = { ...player, id };
      this.playersMap.set(id, newPlayer);
      
      // Add goalkeeper skills for Manuel Neuer
      if (player.name === "Manuel Neuer") {
        const skillsData: InsertSkills = {
          playerId: id,
          reflexes: 95,
          positioning: 88,
          oneOnOnes: 92,
          commandOfArea: 90,
          distribution: 85,
          handling: 87
        };
        
        const skillsId = this.currentSkillsId++;
        const skills: Skills = { ...skillsData, id: skillsId };
        this.skillsMap.set(skillsId, skills);
      }
    });
    
    // Seed challenges
    const challenges: InsertChallenge[] = [
      {
        title: "Weekend Tournament",
        image: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=280",
        status: "days_left",
        statusValue: "3 days left",
        participants: 24,
        location: "Central Stadium",
        prize: "$500 prize pool",
        theme: "primary"
      },
      {
        title: "Goalkeeper Showdown",
        image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=280",
        status: "ongoing",
        statusValue: "Ongoing",
        participants: 12,
        location: "Training Grounds",
        prize: "Custom Gloves Prize",
        theme: "secondary"
      },
      {
        title: "Penalty Shootout",
        image: "https://pixabay.com/get/g951c406f059e5f4f477332be086473261534d8ee25fc8bb9341979a88cb2938fd8da6cf3b7fe9e1afba39ad9589b26c41b999e9bf240e7242e182ae2b5c875f1_1280.jpg",
        status: "days_left",
        statusValue: "1 week left",
        participants: 32,
        location: "Multiple Locations",
        prize: "Champion Title + Trophy",
        theme: "accent"
      }
    ];
    
    // Create challenges in storage
    challenges.forEach(challenge => {
      const id = this.currentChallengeId++;
      const newChallenge: Challenge = { ...challenge, id };
      this.challengesMap.set(id, newChallenge);
    });
  }
}

export const storage = new MemStorage();
