const cloudinary = require("../middleware/cloudinary");
const Post = require("../models/Post");
const Streak = require("../models/Streak")
const Journal = require("../models/Journal")
const streakControllers = require("../controllers/streak")

// Benefit timetable API (per day)
const benefits = {
  0: 'You better STOP smoking NOW!',
  '1': 'Your anxieties have peaked in intensity, but it will drop within two weeks and should return to near pre-cessation levels. Also, GOOD NEWS! Your carbon monoxide levels have dropped to normal, same as your blood pressure, pulse rate and the temperature of your hands and feet. The remaining nicotine in your bloodstream has fallen to 6.25% of normal peak daily levels, a 93.75% reduction. Your blood oxygen level has increased to normal. KEEP THE HARD WORK!',
  '2': 'Damaged nerve endings have started to regrow and your sense of smell and taste are beginning to return to normal. Cessation anger and irritability have peaked.',
  '3': "Your entire body will test 100% nicotine-free. Over 90% of all nicotine metabolites (the chemicals nicotine breaks down into) have passed from your body via your urine. Your bronchial tubes leading to air sacs (alveoli) are beginning to relax. Breathing is becoming easier and your lung's functional abilities are improving.",
  '5': 'You are down to experiencing just three induced crave episodes per day. It is unlikely that any single episode will last longer than 3 minutes. Keep a clock handy and time the episode to maintain an honest perspective on time.',
  '10': 'You are down to encountering less than two crave episodes per day.',
  '11': 'Recovery has likely progressed to the point where your addiction is no longer doing the talking. Blood circulation in your gums and teeth are now similar to that of a non-user.',
  '15': "Cessation related anger, anxiety, difficulty concentrating, impatience, insomnia, restlessness and depression have ended. If still experiencing any of these symptoms get seen and evaluated by your physician.",
  '31': "Your heart attack risk has started to drop. Your lung function has noticeably improved. If your health permits, sample your circulation and lung improvement by walking briskly, climbing stairs or running further or faster than normal.",
  '90': "For the next several months after quitting, your circulation continues to improve.",
  '270': "Nine months after quitting, your lungs have significantly healed themselves. The delicate, hair-like structures inside the lungs known as cilia have recovered from the toll cigarette smoke took on them. These structures help push mucus out of the lungs and help fight infections. Around this time, many former smokers like you notice a decrease in the frequency of lung infections because the healed cilia can do their job more easily.",
  '365': "Your risk for coronary heart disease decreases by half. This risk will continue to drop past the 1-year mark.",
  '1825': "Your body has healed itself enough for the arteries and blood vessels to begin to widen again. This widening means the blood is less likely to clot, lowering the risk of stroke.",
  '3650': "Your chances of developing lung cancer and dying from it are roughly cut in half compared with someone who continues to smoke. The likelihood of developing mouth, throat, or pancreatic cancer has significantly reduced.",
  // cut off at 10 years mark
}
function benefitDay (day) { 
  let key = Object.keys(benefits)
        .sort((a, z) => a - z)
        .filter((n, i, arr) => {
          if (n == day ){
            return n
          }else if ( n < day && arr[i+1] > day ){
            return n
          }
        })
  return key
}

module.exports = {
  getProfile: async (req, res) => {
    try {
      const posts = await Post.find({ user: req.user.id });
      const userStreak = await Streak.find({ userId: req.user.id });
      const journalEntries = await Journal.find({ userId: req.user.id })

      //TODO: Update streak
      streakControllers.updateStreak(req.user)
      // grab streak value from streak document
      let streak = userStreak[0].streak

      // determine durantion of streak match benefit day
      let todayMsg = benefits[benefitDay(streak)]

      //Count trigger occurances -- not finished or tested i'm sorry i'm so tired//////////////////////////////////////////
      let triggerCounts = {
        'talking on the phone': 0,
        'drinking alcohol': 0,
        'watching tv': 0,
        'driving': 0,
        'drinking coffee': 0,
        'taking a work break': 0,
        'after having sex': 0,
        'before going to bed': 0,
        'going to a bar': 0,
        'seeing someone else smoke': 0,
        'being with friends who smoke': 0,
        'celebrating a big event': 0,
        'custom trigger': 0
      }
      journalEntries.forEach(entry => { 
        if (entry.smoked) {
          for (let trigger in entry) {
            if (trigger == 'talkingOnPhone' ) {
              triggerCounts['talking on the phone'] += 1
            }
          }
        }
      })//trigger count mess ends here if you want to just delete this garbage

      res.render("profile.ejs", { posts: posts, user: req.user, message: todayMsg, streak: streak, journal: journalEntries });
    } catch (err) {
      console.log(err);
    }
  },
  getJournal: async (req, res) => {
    try {
      res.render("journal.ejs", { trigger: req.user.triggers })
    } catch (err) {
      console.log(err)
    }
    
  },
  getFeed: async (req, res) => {
    try {
      const posts = await Post.find().sort({ createdAt: "desc" }).lean();
      res.render("feed.ejs", { posts: posts });
    } catch (err) {
      console.log(err);
    }
  },
  getPost: async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      res.render("post.ejs", { post: post, user: req.user });
    } catch (err) {
      console.log(err);
    }
  },
  createJournal: async (req, res) => {
    //might be able to add logic that only allows user to submit this form once/day
    try {
      await Journal.create({
        userId: req.user.id,
        smoked: req.body.smokedToday,
        triggers: req.body.triggers,
        cravingsLevel: req.body.cravingsLevel,
        anxietyLevel: req.body.anxietyLevel,
        excitementLevel: req.body.excitementLevel,
        boredomLevel: req.body.boredomLevel,
        sadnessLevel: req.body.sadnessLevel,
        happinessLevel: req.body.happinessLevel,
        lonelinessLevel: req.body.lonelinessLevel,
      });

      //If the user indicates they've smoked today, reset their streak count to 0. Otherwise, increment their streak county by 1.
      const streak = await Streak.find({ userId: req.user.id}) //can this be removed?
      if(req.body.smokedToday == 'true') {
        await Streak.findOneAndUpdate({ userId: req.user.id },
          { $set: {
            startDate: null,
            isCurrentStreak: false,
            streak: 0
          }}, (err, result)=>{})
      }else{
        await Streak.findOneAndUpdate({ userId: req.user.id}, {
          $inc:{streak: +1}
        })
      }
      console.log("Journal entry has been added!");

      //if anxiety level is greater than 5, redirect to the page with a list of games. Otherwise, redirect to the user's profile.
      if (req.body.anxietyLevel > 5) {
        res.redirect("/relax")
      } else {
        res.redirect("/profile");
      }
    } catch (err) {
      console.log(err);
    }
  },
  createPost: async (req, res) => {
    try {
      // Upload image to cloudinary
      const result = await cloudinary.uploader.upload(req.file.path);

      await Post.create({
        title: req.body.title,
        image: result.secure_url,
        cloudinaryId: result.public_id,
        caption: req.body.caption,
        likes: 0,
        user: req.user.id,
      });
      console.log("Post has been added!");
      res.redirect("/profile");
    } catch (err) {
      console.log(err);
    }
  },
  likePost: async (req, res) => {
    try {
      await Post.findOneAndUpdate(
        { _id: req.params.id },
        {
          $inc: { likes: 1 },
        }
      );
      console.log("Likes +1");
      res.redirect(`/post/${req.params.id}`);
    } catch (err) {
      console.log(err);
    }
  },
  deletePost: async (req, res) => {
    try {
      // Find post by id
      let post = await Post.findById({ _id: req.params.id });
      // Delete image from cloudinary
      await cloudinary.uploader.destroy(post.cloudinaryId);
      // Delete post from db
      await Post.remove({ _id: req.params.id });
      console.log("Deleted Post");
      res.redirect("/profile");
    } catch (err) {
      res.redirect("/profile");
    }
  },  
};
