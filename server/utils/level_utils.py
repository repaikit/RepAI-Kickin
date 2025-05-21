LEVEL_MILESTONES_BASIC = [
    0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000, 21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500, 46500, 49600, 52800, 56100, 59500, 63000, 66600, 70300, 74100, 78000, 82000, 86100, 90300, 94600, 99000, 103500, 108100, 112800, 117600, 122500, 127500, 132600, 137800, 143100, 148500, 154000, 159600, 165300, 171100, 177000, 183000, 189100, 195300, 201600, 208000, 214500, 221100, 227800, 234600, 241500, 248500, 255600, 262800, 270100, 277500, 285000, 292600, 300300, 308100, 316000, 324000, 332100, 340300, 348600, 357000, 365500, 374100, 382800, 391600, 400500, 409500, 418600, 427800, 437100, 446500, 456000, 465600, 475300, 485100, 495000
]
LEGEND_STEP = 100
LEGEND_MAX = 10
VIP_LEVELS = [
    ("SILVER", 50),
    ("GOLD", 100),
    ("RUBY", 150),
    ("EMERALD", 200),
    ("DIAMOND", 500)
]

def get_total_point_for_level(user):
    if user.get("is_vip", False):
        return user.get("total_point", 0)
    else:
        week_history_point = sum(w.get("point", 0) for w in user.get("week_history", []))
        return week_history_point + user.get("total_point", 0)

def get_basic_level(total_point):
    for i, milestone in enumerate(LEVEL_MILESTONES_BASIC):
        if total_point < milestone:
            return i
    return len(LEVEL_MILESTONES_BASIC)

def get_legend_level(total_point):
    if total_point < LEVEL_MILESTONES_BASIC[99]:
        return 0
    legend = (total_point - LEVEL_MILESTONES_BASIC[99]) // LEGEND_STEP + 1
    return min(legend, LEGEND_MAX)

def get_vip_level(vip_amount):
    level = "NONE"
    for name, amount in VIP_LEVELS:
        if vip_amount >= amount:
            level = name
    return level

async def update_user_levels(user_id: str, db):
    user = await db.users.find_one({"_id": user_id if hasattr(user_id, 'binary') else user_id})
    if not user:
        return None
    total_point_for_level = get_total_point_for_level(user)
    current_level = user.get("level", 1)
    new_level = get_basic_level(total_point_for_level)
    can_level_up = new_level > current_level
    is_pro = new_level >= 100
    if is_pro:
        new_level = 100
        legend_level = get_legend_level(total_point_for_level)
    else:
        legend_level = 0
    vip_amount = user.get("vip_amount", 0)
    vip_level = get_vip_level(vip_amount)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "level": new_level,
            "is_pro": is_pro,
            "legend_level": legend_level,
            "vip_level": vip_level
        }}
    )
    return {
        "level": new_level,
        "is_pro": is_pro,
        "legend_level": legend_level,
        "vip_level": vip_level,
        "total_point_for_level": total_point_for_level,
        "can_level_up": can_level_up
    } 