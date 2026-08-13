# "Diary"

**2026-03-19** - I was considering using `notify`, but it will cause more problems than benefits. So I am looking for a better, more robust alternative.
Solution:

- Another table called "directory" will be created; instead of saving the full file path, only the file name and extension will be saved, and the path will be saved in that table.
- This problem won't bring significant optimizations, but it will bring more clarity and organization. Using pagination by directory and making it clearer even for the user, e.g.: `analyzing directory: /musica/joel amarim`, it is also good for logs and debug.
- With that, the verification will be done "manually", comparing the "size + timestamp" of the files in the directory to see whether there was a change or not.
- If a file is found in the directory that is not in the database, it must be ignored (skipped).

**2026-03-20** - I am in doubt about how to integrate the Client and Server in the application. I don't know how the flow, the database, etc. will be.

- The idea is simple: the client changes, the system must mark that it was changed. I will start from the principle of trust, since it is local software that lay people will use.
- Solution:
  - Create a table for changes. This table must have the old and new information.
  - Based on that, there will be a modal or page that lists all pending changes (to the server) made by the client; they will approve or reject them.
  - The approved ones are applied to the definitive table; the rejected ones are discarded.
  - If it is a file, there must be an option for the user to click to see the original and the changed one.
- ! Attention: When the change (`field`) is `file`, I need to be careful and draw up a good plan so that there is no conflict or disorganization.

**2026-03-20** - Future problems that I need to have solved or be thinking of a solution for.

- Large changes in the database.
- Large changes in the schema (MessagePack).
- Better conflict resolution (several computers updating at the same time)

**2026-03-21** - Problem with Google Drive.

- I racked my brain yesterday and today trying to do a simple update.

- So I reached three possibilities:

  1. Use python in the background with SKD.
  - It has the following problems:

    1. Python would have to be installed on the computer.

    2. I would have to maintain it (updates and code adjustments).
  1. Use another cloud provider, pCloud.
  - It has the following problems:

    1. It is not as robust and reliable as Google Drive (market standard).

    2. I have never used it and have no idea how it works. It appears to be simpler.
  1. Use rclone to take care of it.
  - It has the following problem:

    1. rclone needs to be installed and kept up to date.
       ! My choice was to use rclone, due to having to do less code maintenance; it's just a matter of updating it and done.
       ! But, if I see that it will be a big headache, I can use rclone with pCloud (or via API directly in the code). For now, my decision is Google Drive, but I will be studying and testing pCloud in parallel.

**2026-03-23** - Changes and improvements

- 1st Change in the database, removing useless tables and standardizing the name.
  - There were many tables and fields that made sense in the beginning and in my head, but now they no longer do.
- 2nd Change from `.xz` to `.zst` (zstd - Zstandard).
  - Due to the better balance, the best choice is `Zstandard`.
- 3rd Addition of detailed flows.

**2026-03-24**

Changing upload strategy to the Cloud

- I was thinking of only uploading to the Cloud when all the song's scores were `main`. But that can frustrate the user.
- Scenario: A change was made to the Flute and Tuba scores; the flute was finished and can already be used in rehearsals, while the Tuba needs more changes.
- The choice of uploading to the Cloud only when the whole song is `main` is simpler. The alternative of doing it per score is more complex, but will add value for the user.

Changing strategy: from full database to increment/change/removal

- Instead of creating a single `database.msgpack` file, which has:
  - Risk of being overwritten.
  - Delay to identify and implement changes.
  - Greater complexity for synchronization.
- `{computerId}.msgpack` will be used, which will do:
  - What was implemented.
  - What was changed.
  - What was deleted.

**2026-03-26**

Problems and problems

- I thought of a possible problem: "What if `{computerId}.msgpack` becomes a little monster of 10MB or more".
- I thought of splitting `{computerId}.msgpack` into pieces: `{computerId}_{sequence}.msgpack`, always creating a new file as soon as it reaches 1MB. But over time this would pollute the directory a lot.
- And in both cases there is the same problem: If a new computer is added, it would have to read all the files, applying event by event until reaching the same state as the other computers. It would be an inferno of slowness and complexity.
- Solution: `{computerId}.msgpack` and `snapshot` of the database. When the `{computerId}.msgpack` files reach a certain size, the server will generate a `snapshot` of the current database.

**2026-03-27**

I got ahead of myself

- I should have drawn up my plans better. Much of what I thought/implemented was wrong or would be done wrong.
- So, I will abandon version 0.3 due to the mess it became.
- Now with the macro and micro view of the system, it will be easier to organize the versions.
- The idea now is to implement a feature and test it massively.

**2026-03-30**

Simplifying the obvious

- The application until the stable version `v1` will be only `client read-only`.
- This will reduce the complexity A LOT and speed up development A LOT.
- Since I already have a base structure, this will help with the long-term vision, if there is a future in this application (only God knows and I hope so).

Changing the name (more simplification)

- I will change from `{computerId}.msgpack` to `events.msgpack` simply, because it makes no sense to add this now. It is easier and more direct to simply use a standard name.
- But that doesn't mean I'll discard the idea, that's why I'm documenting it here. In the future I intend to implement it.

**2026-04-01**

Goodbye Google Drive, no April 1st prank

- I found an excellent substitute for Google Drive. What bothered me about it is the slowness due to the various checks and processing on the file.
- I just wanted something simple, to upload and download, and that wouldn't cause problems.
- I was considering pCloud, but due to limitations of the free account I dropped it. I found an excellent substitute called Koofr, the only downside is that it has only 10GB of storage on the free plan, which is not a problem. I did a bunch of tests and it is really very good; adding all the songs of the orchestra where I play, it should be around 2GB (compressed files, obviously).

Today also, I did a bunch of tests and found many problems and many possible improvements. I am VERY satisfied with the result obtained with this project. I believe it will add a lot to users.

**2026-04-02**

Automatic `database.msgpack.zst`

- I am worried about some problem in the application, leading to freezing, data loss, etc. For security reasons, I will implement periodic copies of the database.
- With that, if some problem happens, the user won't need to put everything in manually again.

**2026-04-03**

MicroScore

- I will implement **telemetry** and **license** in the software; since it is quite complete software and, I believe, will help a lot, nothing more fair than charging a price.
- **Telemetry**: my idea is to collect simple information: usage time (per day), number of songs and scores added (per day), how many times scores were opened by it, and number of uploads/downloads made. The idea is to know if the application is being well used, both by the server and by the client. Having a notion of what is most used, client or server?
- **License**: my idea is to create a license per organization, e.g.: orchestra xxx, 1-year license for 8 computers for 300 reais. With that the person will have my full support.
  - The license must be both on the server and locally. Requiring internet access at installation.
  - With that it prevents the person from sending the installer to someone else and done.
    ! I'm noting this here just to put this subject on my "radar". I don't know exactly how it will be done.

**2026-04-05**

`rclone` inside the project, before v1

- I believe it is better to add `rclone` to the project and create a settings page.
- The `rclone` configuration will be done by the application. I believe this will make it much easier for the end user, not having to: install `rclone`, configure it (with risk) and eventually perform updates.
- With that too, I will take responsibility for keeping `rclone` updated, being easier, just updating the application with the new version. Not needing to guide the user, access the machine remotely or have to go to the computer's location.
- Obviously there are other things I will have to implement due to the `MIT` license, but that's part of it. But in the case where this software will start being used, where the people who will use it are lay people (and in general, in the music field), it is the best option.

**2026-04-06**

`ottavada-x64` and `ottavada-x32`

- I was dissatisfied with the user having to choose between "application rclone" or "system rclone", all that to "bypass" x32 systems.
- It was very messy and difficult, now the application will have the `x32` and `x64` version, each with the correct rclone.
- Also, only the "application rclone" will be used, it is easier for the user and there is no need to overload them with: installation and configuration.

**2026-04-09**

Version only for license and update.

- I had the idea, I will distribute lean software, with only the license and update function.
- The goal is to avoid piracy, preventing the person from using everything with the installer.
- Evidently, the user is forced to have internet at installation. Although in any way they are, because otherwise they couldn't configure and test the cloud provider.
- This prevents the installer from being shared without limits, since each license has a limited number of installations.

**2026-04-10**

No `over engineering`

- Previously I decided to do the separation; today, I tested it and reached the conclusion that it is not worth it, very high complexity for few results.
- Solution: The user will receive the complete application. Upon installing, the first thing checked is whether there is an update; if there is, it updates directly, without creating anything in (database, tauri-plugin-store). If there is an update, it must open a page informing that it is necessary to update the application before installing, with a countdown.
- With the latest version installed, the user informs the organization name and the next screen is the license one.

**2026-04-11**

"bye bye money" (license)

- I had a big doubt, how I would limit piracy, how I would monetize, etc., but I believe that for now, the best solution is to leave it completely free. I believe it is more advantageous to leave it 100% as a showcase and at most go to organizations to ask for "financial help".
- With that I will implement telemetry and other things to improve usability and learn where and what to improve in the software, or if it is really being used.
- I think the best choice is to use it as a showcase and experience to get an opportunity as a dev.
- So, what are the plans: focus on telemetry, create a good welcome page, announcing my contact phone, a good presentation of the software.

**2026-04-14**

Fixing the path

- The documentation is quite outdated, mainly regarding the flows. I will release the software as it is, it is sufficiently stable for normal use, that is, `v1.0`.
- Since I made the code with vibe coding, I believe there are many gaps, so I will take a good amount of time to study the code, fix it and learn.
- Besides changing where the documentation is made and updated (obsidian, I don't know which tool I will actually use), now I already have a better view of the software, the documentation was made at a time when I didn't have a complete view of the software and of the enormous number of existing flows.
- So to keep the software working well, the best choice is to update and improve the documentation.

**2026-04-15**

Simplifying telemetry

- It is being quite annoying to implement telemetry, due to many events and possibilities, so for `v1` what really matters is: the software is being used, what problems users are having and some extra information.

**2026-05-11**

The conductor of my orchestra is not using the tool and the feedback did not come, despite the attempts. To avoid friction and unproductive insistence, I will shift focus to validate the product in another organization.

Identified errors:

- I knew the pain as an orchestra assistant, but I didn't observe the conductor's real flow before building the software (I had a slight view, but I didn't ask or investigate).
- I should have prepared better when showing it; even though the software is "free", I should have been better at "selling the fish", showing how ugly it was before and now with the "fish" it gets easier and prettier.

Next step and fixes:

- Look for another organization with a similar problem, with greater openness to test the tool and give practical feedback.
- Create a powerpoint to illustrate the problem and the solution.
- Train my "salesperson" and confident side more (take this seriously).
- Let the conductor use the tool, to "feel it".

I need to be careful:

- Solve a concrete pain (ok)
- Require little habit change (don't know)
- Be simple to explain (more or less)
  - This part is more complicated, because I put a bunch of things to "facilitate" life, but it ends up increasing the explanation and making it more tiring. So, when explaining I will focus only on the key features and not on the facilitators.
- Show immediate gain (don't know).

Next steps and improvements:

- I need to have well documented EXACTLY the problems the software solves and be able to explain/say clearly to the person these problems.
- I need to create a launcher and find a way to remove the damn Windows suspicious software message (Microsoft Defender SmartScreen).
  - Even if I have to spin up 1000 virtual machines and download Ottavada on the 1000.

**2026-05-23**

Radical change of the software and documentation. Recently I was at the house of the conductor of the orchestra I'm part of and saw how much my software is still badly designed and implemented. So, I will adjust it, starting with the documentation, I really don't like the way the documentation is done. If I have a doubt or need to update something, I want to go straight to it and not have to keep searching.

Changes:

- Indexing directory will really index directories.

- Ottavada will interfere more directly in the files.

- Use system metadata.

- Greater software customization.

**2026-06-14** - Difficulty identifying false changes in music files

I am studying ways to identify false changes, mainly in Finale, since it has the chronic problem of suggesting saving, even if nothing was changed in the file. But it is being a real challenge, since each version of Finale has a way of saving data, so a `.mus` file saved in Finale 11, if opened and saved (even without changing the score) the file hash will change. There is also this problem with `.musx`, even converting to `.zip`, decompressing and checking `score.dat`. This problem is not exclusive to Finale.

My idea of avoiding false positives is to avoid headaches for the user: a valid score, for staying `draft` and not being sent to the client, leaving the user hanging (since scores that are changed are changed to `draft` and are not sent to the client).

I did add this function to **Ottavada**: whenever a score is changed (date and time of last change), check the file hash to really see if it was changed. But simply this doesn't solve it, I need to find another simple way to avoid this; I don't intend to keep hash and have to handle each music file, e.g.: `.musx` convert to `.zip` to then check the hash of `score.dat`, with a chance that even so it will cause problems, and the same process or similar for the other extensions. So, I prefer to keep the simplicity of the application, checking only the last change date/time and file size.

The solution will be to leave the change review modal more organized and intelligent: being able to check and uncheck, applying only when the user clicks "confirm".

**2026-06-27** - Focus abroad

Staying focused only on Brazilian people will limit my chances of Ottavada succeeding a lot. This happens because Brazil is an underdeveloped country, so most people use Windows 7 (older people) and also people abroad are more forward-looking, always seeking to modernize and improve, unlike Brazil, where most prefer to keep the standard. Not to mention the MUCH larger number of orchestras and bands.

I'm not speaking badly of Brazil, this is the reality and it works (not so well, but it works). I'm just making the best decision for the future of my tool. Not to mention that I can promote it saying it is an international application, gaining more trust.

**2026-06-29** - Mermaid vs Draw.io

I don't like Mermaid: I find it more annoying to make the diagram and the final result is less pretty. But since the goal of the documentation is to be easy for people and LLMs, I will use Mermaid in a way that is good for both. Mermaid is pure and simple text, while Draw.io is XML, being more difficult for LLMs.

**2026-07-01** - Project name change

The project name was changed from **Ottavada** to **Ottavada**. Ottavada is an excellent name, but had big problems: 1st The **.com** domain was already in use; 2nd LLMs got tangled to explain it, since it is the junction of **Score** + **Maestro**; 3rd **Score** can mean SEVERAL things besides a score; 4th It is an extremely generic name that is easy to copy. **Ottavada** comes from *oitarvar* or *ottava*, and the *da* came from the idea of "oitavada", the score is "oitavada", replacing the "i" with "t" it becomes **ottavada**. I needed a name that was good for Brazil and abroad, I arrived at this name.

**2026-08-13** - Change language to English

From now on, all project text must be written in English, and we will adopt the ISO 8601 date/time standard (YYYY-MM-DD and 24-hour time) for all internal records, logs, and APIs. I should have done this a long time ago, when the project added support for multiple languages.
